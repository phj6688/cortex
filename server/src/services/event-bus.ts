/**
 * In-process typed event bus for SSE push.
 * @module services/event-bus
 */

import type { TaskState } from '../domain/task-machine.js';
import { eventId } from '../lib/id.js';

/** All SSE event types */
export type SSEEventType =
  | 'task_created'
  | 'task_state_changed'
  | 'ao_update'
  | 'cost_update'
  | 'comment_added'
  | 'session_state_changed'
  | 'audit_complete'
  | 'verification_result'
  | 'heartbeat';

export interface SSEEvent {
  id: string;
  type: SSEEventType;
  data: Record<string, unknown>;
  ts: number;
}

type Listener = (event: SSEEvent) => void;

const listeners = new Set<Listener>();
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Emit an event to all listeners.
 * @param type - Event type
 * @param data - Event payload
 * @returns void
 */
function emit(type: SSEEventType, data: Record<string, unknown>): void {
  const event: SSEEvent = {
    id: eventId(),
    type,
    data,
    ts: Math.floor(Date.now() / 1000),
  };
  for (const fn of listeners) {
    try {
      fn(event);
    } catch (err) {
      console.error('[event-bus] listener error:', err);
    }
  }
}

/**
 * Subscribe to all events.
 * @param fn - Listener callback
 * @returns Unsubscribe function
 */
export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** @param taskId - ID of the created task */
export function publishTaskCreated(taskId: string): void {
  emit('task_created', { taskId });
}

/**
 * @param taskId - Task ID
 * @param from - Previous state
 * @param to - New state
 */
export function publishTaskStateChanged(taskId: string, from: TaskState, to: TaskState): void {
  emit('task_state_changed', { taskId, from, to });
}

/**
 * @param taskId - Task ID
 * @param event - AO event name
 */
export function publishAoUpdate(taskId: string, event: string): void {
  emit('ao_update', { taskId, event });
}

/**
 * @param taskId - Task ID
 * @param costUsd - Updated cost
 */
export function publishCostUpdate(taskId: string, costUsd: number): void {
  emit('cost_update', { taskId, cost_usd: costUsd });
}

/**
 * @param taskId - Task ID
 * @param commentId - Comment ID
 */
export function publishCommentAdded(taskId: string, commentId: string): void {
  emit('comment_added', { taskId, commentId });
}

/**
 * Publish session state change.
 * @param taskId - Parent task ID
 * @param sessionId - Session ID
 * @param state - New session state
 */
export function publishSessionStateChanged(taskId: string, sessionId: string, state: string): void {
  emit('session_state_changed', { taskId, sessionId, state });
}

/**
 * Publish audit completion.
 * @param taskId - Task ID
 * @param summary - Audit summary counts
 */
export function publishAuditComplete(taskId: string, summary: Record<string, number>): void {
  emit('audit_complete', { taskId, summary });
}

/**
 * Publish verification result.
 * @param taskId - Task ID
 * @param sessionId - Session ID
 * @param passed - Whether verification passed
 */
export function publishVerificationResult(taskId: string, sessionId: string, passed: boolean): void {
  emit('verification_result', { taskId, sessionId, passed });
}

/** Start 15s heartbeat timer */
export function startHeartbeat(): void {
  if (heartbeatTimer) return;
  heartbeatTimer = setInterval(() => {
    emit('heartbeat', { ts: Math.floor(Date.now() / 1000) });
  }, 15_000);
}

/** Stop heartbeat timer */
export function stopHeartbeat(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}
