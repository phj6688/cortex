/**
 * AO Status Poller — 10s interval, only for dispatched|running tasks.
 * Self-cancels when no active tasks remain.
 * @module services/ao-status-poller
 */

import { listTasks, updateTask } from '../db/queries/tasks.js';
import { createEvent } from '../db/queries/events.js';
import { getStatus } from './ao-dispatch.js';
import { publishTaskStateChanged } from './event-bus.js';
import { eventId } from '../lib/id.js';
import { getDb } from '../db/connection.js';
import type { TaskState } from '../domain/task-machine.js';

const POLL_INTERVAL_MS = 10_000;
const DISPATCH_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const STUCK_TIMEOUT_MS = 30 * 60 * 1000;   // 30 minutes

let pollTimer: ReturnType<typeof setInterval> | null = null;

interface MinimalLogger {
  info(msg: string, ...args: unknown[]): void;
  warn(msg: string, ...args: unknown[]): void;
  error(msg: string, ...args: unknown[]): void;
}

let logger: MinimalLogger = console;

/**
 * Check a single task for timeouts and status updates.
 * @param task - Task to check
 */
async function checkTask(task: {
  id: string;
  state: TaskState;
  ao_session_id: string | null;
  dispatched_at: number | null;
  updated_at: number;
}): Promise<void> {
  const now = Date.now();

  // Dispatch timeout: dispatched >5min with no response → mark failed
  if (task.state === 'dispatched' && task.dispatched_at) {
    const elapsed = now - task.dispatched_at * 1000;
    if (elapsed > DISPATCH_TIMEOUT_MS) {
      const db = getDb();
      db.transaction(() => {
        updateTask(task.id, {
          state: 'failed',
          failure_reason: 'Agent did not respond within 5 minutes',
          completed_at: Math.floor(now / 1000),
        });
        createEvent({
          id: eventId(),
          task_id: task.id,
          event_type: 'failed',
          from_state: 'dispatched',
          to_state: 'failed',
          payload: JSON.stringify({ reason: 'dispatch_timeout' }),
          actor: 'system',
        });
      })();
      publishTaskStateChanged(task.id, 'dispatched', 'failed');
      logger.warn(`Task ${task.id} timed out (dispatched >5min)`);
      return;
    }
  }

  // Stuck detection: running >30min no heartbeat → mark failed
  if (task.state === 'running') {
    const lastActivity = task.updated_at * 1000;
    const elapsed = now - lastActivity;
    if (elapsed > STUCK_TIMEOUT_MS) {
      const db = getDb();
      db.transaction(() => {
        updateTask(task.id, {
          state: 'failed',
          failure_reason: 'Agent session appears stuck (no activity for 30 minutes)',
          completed_at: Math.floor(now / 1000),
        });
        createEvent({
          id: eventId(),
          task_id: task.id,
          event_type: 'failed',
          from_state: 'running',
          to_state: 'failed',
          payload: JSON.stringify({ reason: 'stuck_timeout' }),
          actor: 'system',
        });
      })();
      publishTaskStateChanged(task.id, 'running', 'failed');
      logger.warn(`Task ${task.id} marked stuck (running >30min no activity)`);
      return;
    }
  }

  // Poll AO for status updates (only if we have a session)
  if (task.ao_session_id && task.state === 'running') {
    try {
      const status = await getStatus(task.ao_session_id);
      if (status.status === 'done') {
        const db = getDb();
        db.transaction(() => {
          updateTask(task.id, {
            state: 'done',
            completed_at: Math.floor(now / 1000),
          });
          createEvent({
            id: eventId(),
            task_id: task.id,
            event_type: 'done',
            from_state: 'running',
            to_state: 'done',
            payload: JSON.stringify({ source: 'poller' }),
            actor: 'ao',
          });
        })();
        publishTaskStateChanged(task.id, 'running', 'done');
        logger.info(`Task ${task.id} completed (poller detected)`);
      } else if (status.status === 'failed') {
        const db = getDb();
        db.transaction(() => {
          updateTask(task.id, {
            state: 'failed',
            failure_reason: 'Agent session failed',
            completed_at: Math.floor(now / 1000),
          });
          createEvent({
            id: eventId(),
            task_id: task.id,
            event_type: 'failed',
            from_state: 'running',
            to_state: 'failed',
            payload: JSON.stringify({ source: 'poller' }),
            actor: 'ao',
          });
        })();
        publishTaskStateChanged(task.id, 'running', 'failed');
        logger.warn(`Task ${task.id} failed (poller detected)`);
      }
    } catch (err) {
      logger.error(`Failed to poll AO status for ${task.ao_session_id}: ${err}`);
    }
  }
}

/**
 * Run one poll cycle — check all dispatched/running tasks.
 */
async function pollCycle(): Promise<void> {
  const dispatched = listTasks({ state: 'dispatched' });
  const running = listTasks({ state: 'running' });
  const activeTasks = [...dispatched, ...running];

  if (activeTasks.length === 0) {
    // Self-cancel when no active tasks
    stopPoller();
    logger.info('AO poller stopped — no active tasks');
    return;
  }

  for (const task of activeTasks) {
    await checkTask(task);
  }
}

/**
 * Start the AO status poller.
 * Safe to call multiple times — won't create duplicate timers.
 * @param log - Logger instance
 */
export function startPoller(log?: MinimalLogger): void {
  if (log) logger = log;
  if (pollTimer) return;

  logger.info('AO status poller started (10s interval)');
  pollTimer = setInterval(() => {
    pollCycle().catch((err) => {
      logger.error(`Poller cycle error: ${err}`);
    });
  }, POLL_INTERVAL_MS);

  // Run immediately on start
  pollCycle().catch((err) => {
    logger.error(`Initial poller cycle error: ${err}`);
  });
}

/**
 * Stop the AO status poller.
 */
export function stopPoller(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

/**
 * Check if the poller is currently running.
 * @returns Whether the poller is active
 */
export function isPollerRunning(): boolean {
  return pollTimer !== null;
}
