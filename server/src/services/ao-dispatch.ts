/**
 * AO Dispatch — HTTP v1 (preferred) + CLI v2 fallback.
 * SAFE: uses execFile only, never exec().
 * @module services/ao-dispatch
 */

import { execFile } from 'node:child_process';
import { writeFileSync, unlinkSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { env } from '../env.js';
import type { TaskRow } from '../db/queries/tasks.js';

const execFileAsync = promisify(execFile);

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

/**
 * Dispatch a task to Agent Orchestrator via HTTP, falling back to CLI.
 * @param task - Approved task with brief and project_id
 * @returns Session ID and branch name
 */
export async function dispatch(task: TaskRow): Promise<DispatchResult> {
  if (!task.brief) throw new Error('Cannot dispatch task without a brief');
  if (!task.project_id) throw new Error('Cannot dispatch task without a project');

  const aoBaseUrl = env.AO_BASE_URL;

  // v1 — HTTP (preferred)
  if (aoBaseUrl) {
    try {
      const res = await fetch(`${aoBaseUrl}/api/spawn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project: task.project_id,
          rules: formatBriefForAgent(task.brief),
          sessionId: task.id,
        }),
        signal: AbortSignal.timeout(30_000),
      });

      if (res.status === 404) {
        // AO doesn't support /api/spawn — fall through to CLI
        return dispatchCLI(task);
      }

      if (!res.ok) {
        throw new Error(`AO spawn failed: ${res.status} ${res.statusText}`);
      }

      const data = (await res.json()) as { sessionId: string; branch: string };
      return {
        sessionId: data.sessionId ?? task.id,
        branch: data.branch ?? `cortex/${task.id}`,
      };
    } catch (err) {
      if (err instanceof DOMException && err.name === 'TimeoutError') {
        throw new Error('AO spawn timed out after 30 seconds');
      }
      // Network error — try CLI fallback
      if ((err as Error).message?.includes('fetch failed')) {
        return dispatchCLI(task);
      }
      throw err;
    }
  }

  // No AO_BASE_URL configured — use CLI
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
    const { stdout } = await execFileAsync('ao', [
      'spawn',
      task.project_id!,
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

    const data = (await res.json()) as {
      status: string;
      branch?: string;
      prUrl?: string;
    };

    const statusMap: Record<string, AOSessionStatus['status']> = {
      running: 'running',
      done: 'done',
      failed: 'failed',
      completed: 'done',
      error: 'failed',
    };

    return {
      sessionId,
      status: statusMap[data.status] ?? 'unknown',
      branch: data.branch,
      prUrl: data.prUrl,
    };
  } catch {
    return { sessionId, status: 'unknown' };
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
