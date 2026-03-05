/**
 * Event log — append-only, prepared statements.
 * @module db/queries/events
 */

import { getDb } from '../connection.js';

export interface EventRow {
  id: string;
  task_id: string;
  event_type: string;
  from_state: string | null;
  to_state: string | null;
  payload: string;
  actor: string;
  created_at: number;
}

/**
 * Insert a new event.
 * @param data - Event data
 * @returns void
 */
export function createEvent(data: {
  id: string;
  task_id: string;
  event_type: string;
  from_state?: string | null;
  to_state?: string | null;
  payload?: string;
  actor?: string;
}): void {
  const stmt = getDb().prepare(`
    INSERT INTO events (id, task_id, event_type, from_state, to_state, payload, actor)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    data.id,
    data.task_id,
    data.event_type,
    data.from_state ?? null,
    data.to_state ?? null,
    data.payload ?? '{}',
    data.actor ?? 'system',
  );
}

/**
 * Get events for a task, newest first.
 * @param taskId - Task ID
 * @param limit - Max events to return
 * @returns Array of event rows
 */
export function getEventsForTask(taskId: string, limit = 50): EventRow[] {
  return getDb()
    .prepare('SELECT * FROM events WHERE task_id = ? ORDER BY created_at DESC LIMIT ?')
    .all(taskId, limit) as EventRow[];
}

/**
 * Get events by type.
 * @param eventType - Event type filter
 * @param limit - Max events to return
 * @returns Array of event rows
 */
export function getEventsByType(eventType: string, limit = 50): EventRow[] {
  return getDb()
    .prepare('SELECT * FROM events WHERE event_type = ? ORDER BY created_at DESC LIMIT ?')
    .all(eventType, limit) as EventRow[];
}
