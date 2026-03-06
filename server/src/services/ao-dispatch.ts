/**
 * AO Dispatch — HTTP v1 (preferred) + CLI v2 fallback.
 * SAFE: uses execFile only, never exec().
 * @module services/ao-dispatch
 */

import { execFile } from 'node:child_process';
import { writeFileSync, unlinkSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import pino from 'pino';
import { env } from '../env.js';
import type { TaskRow } from '../db/queries/tasks.js';

const execFileAsync = promisify(execFile);
const log = pino({ name: 'ao-dispatch', level: env.LOG_LEVEL });

export interface DispatchResult {
  sessionId: string;
  branch: string;
}

export interface AOSessionStatus {
  sessionId: string;
  status: 'running' | 'done' | 'failed' | 'unknown';
  branch?: string;
  prUrl?: string;
}

/**
 * Format a task brief for the agent.
 * @param brief - The refined brief text
 * @returns Formatted brief string
 */
function formatBriefForAgent(brief: string): string {
  return brief.trim();
}

/**
 * Write brief to a temp file for CLI fallback.
 * @param taskId - Task ID (used for filename)
 * @param brief - Brief content
 * @returns Path to the temp file
 */
function writeBriefTempFile(taskId: string, brief: string): string {
  const dir = join(process.cwd(), 'data', 'briefs');
  mkdirSync(dir, { recursive: true });
  const filePath = join(dir, `${taskId}.md`);
  writeFileSync(filePath, brief, 'utf-8');
  return filePath;
}

/** AO spawn response shape */
interface AOSpawnResponse {
  session: {
    id: string;
    branch: string;
    status: string;
  };
}

/** AO session status response shape */
interface AOStatusResponse {
  id: string;
  status: string;
  branch?: string;
  pr?: { url?: string };
}

/**
 * Dispatch a task to Agent Orchestrator via HTTP, falling back to CLI.
 * @param task - Approved task with brief and project_id
 * @returns Session ID and branch name
 */
export async function dispatch(task: TaskRow): Promise<DispatchResult> {
  if (!task.brief) throw new Error('Cannot dispatch task without a brief');
  if (!task.project_id) throw new Error('Cannot dispatch task without a project');

  // Cortex stores "prj_cortex_v3", AO config uses "cortex-v3"
  const aoProjectId = task.project_id.replace(/^prj_/, '').replace(/_/g, '-');
  const aoBaseUrl = env.AO_BASE_URL;

  log.info({ taskId: task.id, projectId: task.project_id, aoProjectId, aoBaseUrl }, 'dispatch: starting');

  // v1 — HTTP (preferred)
  if (aoBaseUrl) {
    try {
      log.info({ taskId: task.id, url: `${aoBaseUrl}/api/spawn` }, 'dispatch: POST to AO spawn');
      const res = await fetch(`${aoBaseUrl}/api/spawn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: aoProjectId,
          issueId: task.id,
          prompt: formatBriefForAgent(task.brief!),
        }),
        signal: AbortSignal.timeout(30_000),
      });

      if (res.status === 404) {
        log.warn({ taskId: task.id }, 'dispatch: AO /api/spawn returned 404, falling back to CLI');
        return dispatchCLI(task);
      }

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        log.error({ taskId: task.id, status: res.status, body }, 'dispatch: AO spawn failed');
        throw new Error(`AO spawn failed: ${res.status} ${res.statusText}`);
      }

      const data = (await res.json()) as AOSpawnResponse;
      const result = {
        sessionId: data.session?.id ?? task.id,
        branch: data.session?.branch ?? `cortex/${task.id}`,
      };
      log.info({ taskId: task.id, sessionId: result.sessionId, branch: result.branch }, 'dispatch: success');
      return result;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'TimeoutError') {
        log.error({ taskId: task.id }, 'dispatch: AO spawn timed out after 30s');
        throw new Error('AO spawn timed out after 30 seconds');
      }
      // Network error — try CLI fallback
      if ((err as Error).message?.includes('fetch failed')) {
        log.warn({ taskId: task.id, error: (err as Error).message }, 'dispatch: fetch failed, falling back to CLI');
        return dispatchCLI(task);
      }
      log.error({ taskId: task.id, error: (err as Error).message }, 'dispatch: unexpected error');
      throw err;
    }
  }

  // No AO_BASE_URL configured — use CLI
  log.warn({ taskId: task.id }, 'dispatch: no AO_BASE_URL, using CLI fallback');
  return dispatchCLI(task);
}

/**
 * CLI v2 fallback — execFile ONLY, no shell interpolation.
 * @param task - Task to dispatch
 * @returns Session ID and branch name
 */
async function dispatchCLI(task: TaskRow): Promise<DispatchResult> {
  const briefPath = writeBriefTempFile(task.id, task.brief!);

  try {
    // Strip prj_ prefix and convert underscores to hyphens for AO
    const aoProject = task.project_id!.replace(/^prj_/, '').replace(/_/g, '-');
    const { stdout } = await execFileAsync('ao', [
      'spawn',
      aoProject,
      '--session-id',
      task.id,
      '--rules',
      briefPath,
    ], { timeout: 60_000 });

    // Parse AO CLI output for branch name
    const branchMatch = stdout.match(/branch:\s*(\S+)/i);
    return {
      sessionId: task.id,
      branch: branchMatch?.[1] ?? `cortex/${task.id}`,
    };
  } finally {
    // Clean up temp file
    try {
      unlinkSync(briefPath);
    } catch {
      // Ignore cleanup errors
    }
  }
}

/** Map AO status values to Cortex status values */
const statusMap: Record<string, AOSessionStatus['status']> = {
  spawned: 'running',
  working: 'running',
  exited: 'done',
  killed: 'failed',
  stuck: 'failed',
  errored: 'failed',
  // Legacy values
  running: 'running',
  done: 'done',
  failed: 'failed',
  completed: 'done',
  error: 'failed',
};

/**
 * Get status of an AO session via HTTP.
 * @param sessionId - AO session ID
 * @returns Session status
 */
export async function getStatus(sessionId: string): Promise<AOSessionStatus> {
  const aoBaseUrl = env.AO_BASE_URL;
  if (!aoBaseUrl) {
    return { sessionId, status: 'unknown' };
  }

  try {
    const res = await fetch(`${aoBaseUrl}/api/sessions/${sessionId}`, {
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      return { sessionId, status: 'unknown' };
    }

    const data = (await res.json()) as AOStatusResponse;

    return {
      sessionId,
      status: statusMap[data.status] ?? 'unknown',
      branch: data.branch,
      prUrl: data.pr?.url,
    };
  } catch {
    return { sessionId, status: 'unknown' };
  }
}

/**
 * Send a message to an active AO session.
 * @param sessionId - AO session ID
 * @param message - Message to send to the agent
 */
export async function send(sessionId: string, message: string): Promise<void> {
  const aoBaseUrl = env.AO_BASE_URL;
  if (!aoBaseUrl) {
    await execFileAsync('ao', ['send', sessionId, message], { timeout: 10_000 });
    return;
  }

  const res = await fetch(`${aoBaseUrl}/api/sessions/${sessionId}/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok && res.status !== 404) {
    throw new Error(`AO send failed: ${res.status}`);
  }
}

/**
 * Kill an AO session.
 * @param sessionId - AO session ID to kill
 */
export async function kill(sessionId: string): Promise<void> {
  const aoBaseUrl = env.AO_BASE_URL;
  if (!aoBaseUrl) {
    // CLI fallback
    await execFileAsync('ao', ['kill', sessionId], { timeout: 10_000 });
    return;
  }

  const res = await fetch(`${aoBaseUrl}/api/sessions/${sessionId}/kill`, {
    method: 'POST',
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok && res.status !== 404) {
    throw new Error(`AO kill failed: ${res.status}`);
  }
}
