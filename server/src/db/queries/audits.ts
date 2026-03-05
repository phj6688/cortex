/**
 * Audit verdicts — prepared statements only.
 * @module db/queries/audits
 */

import { getDb } from '../connection.js';

export type VerdictType = 'keep' | 'patch' | 'rewrite' | 'delete' | 'create';

export interface AuditVerdictRow {
  id: string;
  task_id: string;
  file_path: string;
  verdict: VerdictType;
  reason: string;
  patch_details: string | null;
  created_at: number;
}

/**
 * Insert an audit verdict.
 * @param data - Verdict data
 * @returns void
 */
export function insertVerdict(data: {
  id: string;
  task_id: string;
  file_path: string;
  verdict: VerdictType;
  reason: string;
  patch_details?: string | null;
}): void {
  getDb().prepare(`
    INSERT INTO audit_verdicts (id, task_id, file_path, verdict, reason, patch_details)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    data.id,
    data.task_id,
    data.file_path,
    data.verdict,
    data.reason,
    data.patch_details ?? null,
  );
}

/**
 * Get all verdicts for a task.
 * @param taskId - Task ID
 * @returns Array of verdict rows
 */
export function getVerdictsByTask(taskId: string): AuditVerdictRow[] {
  return getDb()
    .prepare('SELECT * FROM audit_verdicts WHERE task_id = ? ORDER BY file_path')
    .all(taskId) as AuditVerdictRow[];
}
