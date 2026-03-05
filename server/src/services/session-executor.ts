/**
 * Session Executor — sequential dispatch with verification gates.
 * @module services/session-executor
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { env } from '../env.js';
import { dispatch, getStatus } from './ao-dispatch.js';
import { buildSessionPrompt } from './prompt-builder.js';
import * as sessionQueries from '../db/queries/sessions.js';
import { updateTask, getTask } from '../db/queries/tasks.js';
import { createEvent } from '../db/queries/events.js';
import {
  publishTaskStateChanged,
  publishSessionStateChanged,
  publishVerificationResult,
} from './event-bus.js';
import { eventId } from '../lib/id.js';
import { getDb } from '../db/connection.js';
import type { SessionPlan } from './decomposer-service.js';
import type { TaskRow } from '../db/queries/tasks.js';

const execFileAsync = promisify(execFile);

interface VerificationResult {
  passed: boolean;
  output: string;
  failed_commands: string[];
}

/**
 * Wait for an AO session to complete.
 * @param aoSessionId - AO session ID
 * @param timeoutMs - Maximum wait time
 * @returns Status string
 */
async function waitForCompletion(
  aoSessionId: string,
  timeoutMs: number,
): Promise<{ status: 'done' | 'failed' }> {
  const deadline = Date.now() + timeoutMs;
  const pollInterval = 10_000;

  while (Date.now() < deadline) {
    const status = await getStatus(aoSessionId);
    if (status.status === 'done') return { status: 'done' };
    if (status.status === 'failed') return { status: 'failed' };
    await new Promise((r) => setTimeout(r, pollInterval));
  }

  return { status: 'failed' };
}

/**
 * Run verification commands for a session.
 * @param commands - Array of shell commands to execute
 * @param cwd - Working directory for commands
 * @returns Verification result
 */
async function runVerification(
  commands: string[],
  cwd?: string,
): Promise<VerificationResult> {
  if (commands.length === 0) {
    return { passed: true, output: 'No verification commands', failed_commands: [] };
  }

  const outputs: string[] = [];
  const failedCommands: string[] = [];

  for (const cmd of commands) {
    const parts = cmd.split(/\s+/);
    const bin = parts[0];
    const args = parts.slice(1);

    if (!bin) continue;

    try {
      const { stdout, stderr } = await execFileAsync(bin, args, {
        timeout: 60_000,
        cwd: cwd ?? process.cwd(),
      });
      outputs.push(`$ ${cmd}\n${stdout}${stderr ? `\nSTDERR: ${stderr}` : ''}`);
    } catch (err) {
      const error = err as { stdout?: string; stderr?: string; message?: string };
      const output = `$ ${cmd}\nFAILED: ${error.stderr ?? error.message ?? 'Unknown error'}`;
      outputs.push(output);
      failedCommands.push(cmd);
    }
  }

  return {
    passed: failedCommands.length === 0,
    output: outputs.join('\n\n'),
    failed_commands: failedCommands,
  };
}

/**
 * Handle a session failure — update state and create event.
 * @param task - Parent task
 * @param sessionId - Session record ID
 * @param reason - Failure reason
 * @param verificationOutput - Raw verification output
 */
function markSessionFailed(
  task: TaskRow,
  sessionId: string,
  reason: string,
  verificationOutput?: string,
): void {
  const db = getDb();
  db.transaction(() => {
    sessionQueries.updateSession(sessionId, {
      state: 'failed',
      failure_reason: reason,
      verification_output: verificationOutput ?? null,
      completed_at: Math.floor(Date.now() / 1000),
    });
    createEvent({
      id: eventId(),
      task_id: task.id,
      event_type: 'failed',
      from_state: 'running',
      to_state: 'failed',
      payload: JSON.stringify({ sessionId, reason }),
      actor: 'system',
    });
  })();
  publishSessionStateChanged(task.id, sessionId, 'failed');
}

/**
 * Mark the parent task as failed and stop execution.
 * @param task - Parent task
 * @param reason - Failure reason
 */
function failTask(task: TaskRow, reason: string): void {
  const db = getDb();
  db.transaction(() => {
    updateTask(task.id, {
      state: 'failed',
      failure_reason: reason,
      completed_at: Math.floor(Date.now() / 1000),
    });
    createEvent({
      id: eventId(),
      task_id: task.id,
      event_type: 'failed',
      from_state: task.state,
      to_state: 'failed',
      payload: JSON.stringify({ reason }),
      actor: 'system',
    });
  })();
  publishTaskStateChanged(task.id, task.state, 'failed');
}

/**
 * Execute a sequence of sessions with verification gates.
 * For each session: build prompt → dispatch → wait → verify → regress → next or fail.
 * @param task - The parent task
 * @param sessions - Ordered session plans
 */
export async function executeSessionSequence(
  task: TaskRow,
  sessions: SessionPlan[],
): Promise<void> {
  const maxRetries = env.DECOMPOSER_MAX_RETRIES;
  const sessionTimeout = env.DECOMPOSER_SESSION_TIMEOUT;

  // Move task to dispatched then running
  updateTask(task.id, { state: 'dispatched', dispatched_at: Math.floor(Date.now() / 1000) });
  publishTaskStateChanged(task.id, 'decomposing', 'dispatched');

  updateTask(task.id, { state: 'running' });
  publishTaskStateChanged(task.id, 'dispatched', 'running');

  for (const session of sessions) {
    const sessionRecord = sessionQueries.getSessionByNumber(task.id, session.session_number);
    if (!sessionRecord) continue;

    // Build the full prompt
    const prompt = buildSessionPrompt(task, session, sessions);
    sessionQueries.updateSession(sessionRecord.id, {
      prompt,
      state: 'dispatched',
      started_at: Math.floor(Date.now() / 1000),
    });
    publishSessionStateChanged(task.id, sessionRecord.id, 'dispatched');

    // Retry loop
    let attemptsPassed = false;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      // Refresh task for latest state
      const currentTask = getTask(task.id)!;

      try {
        // Dispatch to AO
        const aoResult = await dispatch({
          ...currentTask,
          brief: prompt,
        });

        sessionQueries.updateSession(sessionRecord.id, {
          ao_session_id: aoResult.sessionId,
          state: 'running',
          retry_count: attempt,
        });
        publishSessionStateChanged(task.id, sessionRecord.id, 'running');

        // Wait for AO completion
        const completion = await waitForCompletion(aoResult.sessionId, sessionTimeout);

        if (completion.status === 'failed') {
          const reason = `AO session failed (attempt ${attempt + 1}/${maxRetries + 1})`;
          if (attempt < maxRetries) {
            // Record failure for retry context
            sessionQueries.updateSession(sessionRecord.id, {
              failure_reason: reason,
              state: 'ready',
            });
            continue;
          }
          markSessionFailed(currentTask, sessionRecord.id, reason);
          failTask(currentTask, `Session ${session.session_number} (${session.title}) failed after ${maxRetries + 1} attempts`);
          return;
        }

        // Run verification
        sessionQueries.updateSession(sessionRecord.id, { state: 'verifying' });
        publishSessionStateChanged(task.id, sessionRecord.id, 'verifying');

        const verifyResult = await runVerification(session.verification);
        publishVerificationResult(task.id, sessionRecord.id, verifyResult.passed);

        if (!verifyResult.passed) {
          const reason = `Verification failed: ${verifyResult.failed_commands.join(', ')}`;
          if (attempt < maxRetries) {
            sessionQueries.updateSession(sessionRecord.id, {
              failure_reason: reason,
              verification_output: verifyResult.output,
              state: 'ready',
            });
            // Rebuild prompt with failure context for next attempt
            continue;
          }
          markSessionFailed(currentTask, sessionRecord.id, reason, verifyResult.output);
          failTask(currentTask, `Session ${session.session_number} verification failed after ${maxRetries + 1} attempts`);
          return;
        }

        // Run regression checks (prior sessions' verification)
        if (session.regression.length > 0) {
          const regressionResult = await runVerification(session.regression);
          publishVerificationResult(task.id, sessionRecord.id, regressionResult.passed);

          if (!regressionResult.passed) {
            const reason = `Regression failed: ${regressionResult.failed_commands.join(', ')}`;
            markSessionFailed(currentTask, sessionRecord.id, reason, regressionResult.output);
            failTask(currentTask, `Session ${session.session_number} broke prior sessions' verification`);
            return;
          }
        }

        // Session passed
        sessionQueries.updateSession(sessionRecord.id, {
          state: 'passed',
          completed_at: Math.floor(Date.now() / 1000),
          verification_output: verifyResult.output,
        });
        publishSessionStateChanged(task.id, sessionRecord.id, 'passed');

        createEvent({
          id: eventId(),
          task_id: task.id,
          event_type: 'ao_update',
          payload: JSON.stringify({
            session_number: session.session_number,
            title: session.title,
            state: 'passed',
          }),
          actor: 'system',
        });

        attemptsPassed = true;
        break;
      } catch (err) {
        const reason = `Dispatch error: ${(err as Error).message}`;
        if (attempt < maxRetries) {
          sessionQueries.updateSession(sessionRecord.id, {
            failure_reason: reason,
            state: 'ready',
          });
          continue;
        }
        markSessionFailed(currentTask, sessionRecord.id, reason);
        failTask(currentTask, `Session ${session.session_number} failed: ${(err as Error).message}`);
        return;
      }
    }

    if (!attemptsPassed) {
      return; // Already handled in the loop
    }
  }

  // All sessions passed — mark task done
  const db = getDb();
  db.transaction(() => {
    updateTask(task.id, {
      state: 'done',
      completed_at: Math.floor(Date.now() / 1000),
    });
    createEvent({
      id: eventId(),
      task_id: task.id,
      event_type: 'done',
      from_state: 'running',
      to_state: 'done',
      payload: JSON.stringify({ sessions_completed: sessions.length }),
      actor: 'system',
    });
  })();
  publishTaskStateChanged(task.id, 'running', 'done');
}
