/**
 * Task CRUD — prepared statements only.
 * @module db/queries/tasks
 */

import { getDb } from '../connection.js';
import type { TaskState } from '../../domain/task-machine.js';

export interface TaskRow {
  id: string;
  title: string;
  brief: string | null;
  raw_input: string;
  project_id: string | null;
  state: TaskState;
  priority: number;
  ao_session_id: string | null;
  ao_branch: string | null;
  ao_pr_url: string | null;
  failure_reason: string | null;
  cost_usd: number;
  token_input: number;
  token_output: number;
  parent_task_id: string | null;
  metadata: string;
  created_at: number;
  approved_at: number | null;
  dispatched_at: number | null;
  completed_at: number | null;
  updated_at: number;
}

/**
 * List tasks, optionally filtered.
 * @param opts - Filter options
 * @returns Array of task rows
 */
export function listTasks(opts?: {
  projectId?: string;
  state?: TaskState;
  limit?: number;
}): TaskRow[] {
  const db = getDb();

  if (opts?.projectId && opts?.state) {
    const stmt = db.prepare(
      'SELECT * FROM tasks WHERE project_id = ? AND state = ? ORDER BY priority DESC, created_at DESC LIMIT ?'
    );
    return stmt.all(opts.projectId, opts.state, opts.limit ?? 100) as TaskRow[];
  }
  if (opts?.projectId) {
    const stmt = db.prepare(
      'SELECT * FROM tasks WHERE project_id = ? ORDER BY priority DESC, created_at DESC LIMIT ?'
    );
    return stmt.all(opts.projectId, opts.limit ?? 100) as TaskRow[];
  }
  if (opts?.state) {
    const stmt = db.prepare(
      'SELECT * FROM tasks WHERE state = ? ORDER BY priority DESC, created_at DESC LIMIT ?'
    );
    return stmt.all(opts.state, opts.limit ?? 100) as TaskRow[];
  }

  const stmt = db.prepare(
    'SELECT * FROM tasks ORDER BY priority DESC, created_at DESC LIMIT ?'
  );
  return stmt.all(opts?.limit ?? 100) as TaskRow[];
}

/**
 * Get a single task by ID.
 * @param id - Task ID
 * @returns Task row or undefined
 */
export function getTask(id: string): TaskRow | undefined {
  return getDb().prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRow | undefined;
}

/**
 * Find a task by AO session ID.
 * @param sessionId - AO session ID
 * @returns Task row or undefined
 */
export function getTaskByAoSession(sessionId: string): TaskRow | undefined {
  return getDb()
    .prepare('SELECT * FROM tasks WHERE ao_session_id = ?')
    .get(sessionId) as TaskRow | undefined;
}

/**
 * Insert a new task.
 * @param data - Task creation data
 * @returns The created task
 */
export function createTask(data: {
  id: string;
  title: string;
  raw_input: string;
  brief?: string | null;
  project_id?: string | null;
  parent_task_id?: string | null;
  priority?: number;
}): TaskRow {
  const stmt = getDb().prepare(`
    INSERT INTO tasks (id, title, raw_input, brief, project_id, parent_task_id, priority)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    data.id,
    data.title,
    data.raw_input,
    data.brief ?? null,
    data.project_id ?? null,
    data.parent_task_id ?? null,
    data.priority ?? 0,
  );
  return getTask(data.id)!;
}

/**
 * Update task fields.
 * @param id - Task ID
 * @param updates - Fields to update
 * @returns Updated task or undefined
 */
export function updateTask(
  id: string,
  updates: {
    title?: string;
    brief?: string | null;
    state?: TaskState;
    project_id?: string | null;
    priority?: number;
    ao_session_id?: string | null;
    ao_branch?: string | null;
    ao_pr_url?: string | null;
    failure_reason?: string | null;
    cost_usd?: number;
    token_input?: number;
    token_output?: number;
    metadata?: string;
    approved_at?: number | null;
    dispatched_at?: number | null;
    completed_at?: number | null;
  },
): TaskRow | undefined {
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (fields.length === 0) return getTask(id);

  fields.push('updated_at = unixepoch()');
  values.push(id);

  const stmt = getDb().prepare(
    `UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`
  );
  stmt.run(...values);
  return getTask(id);
}

/**
 * Delete a task and its related events.
 * @param id - Task ID
 * @returns void
 */
export function deleteTask(id: string): void {
  const db = getDb();
  db.prepare('DELETE FROM events WHERE task_id = ?').run(id);
  db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
}
