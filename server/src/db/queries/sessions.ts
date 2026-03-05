/**
 * Task sessions CRUD — prepared statements only.
 * @module db/queries/sessions
 */

import { getDb } from '../connection.js';

export type SessionState =
  | 'pending'
  | 'auditing'
  | 'ready'
  | 'dispatched'
  | 'running'
  | 'verifying'
  | 'passed'
  | 'failed'
  | 'skipped';

export interface SessionRow {
  id: string;
  task_id: string;
  session_number: number;
  title: string;
  prompt: string;
  deliverables: string;
  verification: string;
  regression: string;
  anti_patterns: string;
  state: SessionState;
  ao_session_id: string | null;
  audit_report: string | null;
  verification_output: string | null;
  failure_reason: string | null;
  cost_usd: number;
  retry_count: number;
  created_at: number;
  started_at: number | null;
  completed_at: number | null;
}

/**
 * Insert a new task session.
 * @param data - Session creation data
 * @returns void
 */
export function insertSession(data: {
  id: string;
  task_id: string;
  session_number: number;
  title: string;
  prompt?: string;
  deliverables?: string;
  verification?: string;
  regression?: string;
  anti_patterns?: string;
  state?: SessionState;
}): void {
  getDb().prepare(`
    INSERT INTO task_sessions (id, task_id, session_number, title, prompt, deliverables, verification, regression, anti_patterns, state)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.id,
    data.task_id,
    data.session_number,
    data.title,
    data.prompt ?? '',
    data.deliverables ?? '[]',
    data.verification ?? '[]',
    data.regression ?? '[]',
    data.anti_patterns ?? '[]',
    data.state ?? 'pending',
  );
}

/**
 * Get all sessions for a task, ordered by session_number.
 * @param taskId - Task ID
 * @returns Array of session rows
 */
export function getSessionsByTask(taskId: string): SessionRow[] {
  return getDb()
    .prepare('SELECT * FROM task_sessions WHERE task_id = ? ORDER BY session_number ASC')
    .all(taskId) as SessionRow[];
}

/**
 * Get a single session by ID.
 * @param id - Session ID
 * @returns Session row or undefined
 */
export function getSession(id: string): SessionRow | undefined {
  return getDb()
    .prepare('SELECT * FROM task_sessions WHERE id = ?')
    .get(id) as SessionRow | undefined;
}

/**
 * Get a session by task ID and session number.
 * @param taskId - Task ID
 * @param sessionNumber - Session number
 * @returns Session row or undefined
 */
export function getSessionByNumber(taskId: string, sessionNumber: number): SessionRow | undefined {
  return getDb()
    .prepare('SELECT * FROM task_sessions WHERE task_id = ? AND session_number = ?')
    .get(taskId, sessionNumber) as SessionRow | undefined;
}

/**
 * Find a session by AO session ID.
 * @param aoSessionId - AO session ID
 * @returns Session row or undefined
 */
export function getSessionByAO(aoSessionId: string): SessionRow | undefined {
  return getDb()
    .prepare('SELECT * FROM task_sessions WHERE ao_session_id = ?')
    .get(aoSessionId) as SessionRow | undefined;
}

/**
 * Update session fields.
 * @param id - Session ID
 * @param updates - Fields to update
 * @returns Updated session or undefined
 */
export function updateSession(
  id: string,
  updates: {
    state?: SessionState;
    prompt?: string;
    ao_session_id?: string | null;
    audit_report?: string | null;
    verification_output?: string | null;
    failure_reason?: string | null;
    cost_usd?: number;
    retry_count?: number;
    started_at?: number | null;
    completed_at?: number | null;
  },
): SessionRow | undefined {
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (fields.length === 0) return getSession(id);

  values.push(id);
  getDb().prepare(
    `UPDATE task_sessions SET ${fields.join(', ')} WHERE id = ?`
  ).run(...values);

  return getSession(id);
}
