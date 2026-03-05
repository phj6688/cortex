/**
 * Cost + duration aggregation queries.
 * @module db/queries/metrics
 */

import { getDb } from '../connection.js';

export interface MetricsSummary {
  total_tasks: number;
  active_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  total_cost_usd: number;
  total_token_input: number;
  total_token_output: number;
}

/**
 * Get aggregate metrics across all tasks.
 * @returns Summary metrics
 */
export function getSummary(): MetricsSummary {
  const row = getDb().prepare(`
    SELECT
      COUNT(*) as total_tasks,
      SUM(CASE WHEN state IN ('dispatched','running') THEN 1 ELSE 0 END) as active_tasks,
      SUM(CASE WHEN state = 'done' THEN 1 ELSE 0 END) as completed_tasks,
      SUM(CASE WHEN state = 'failed' THEN 1 ELSE 0 END) as failed_tasks,
      COALESCE(SUM(cost_usd), 0.0) as total_cost_usd,
      COALESCE(SUM(token_input), 0) as total_token_input,
      COALESCE(SUM(token_output), 0) as total_token_output
    FROM tasks
  `).get() as MetricsSummary;

  return row;
}

/**
 * Get metrics for a specific project.
 * @param projectId - Project ID
 * @returns Summary metrics for the project
 */
export function getProjectMetrics(projectId: string): MetricsSummary {
  const row = getDb().prepare(`
    SELECT
      COUNT(*) as total_tasks,
      SUM(CASE WHEN state IN ('dispatched','running') THEN 1 ELSE 0 END) as active_tasks,
      SUM(CASE WHEN state = 'done' THEN 1 ELSE 0 END) as completed_tasks,
      SUM(CASE WHEN state = 'failed' THEN 1 ELSE 0 END) as failed_tasks,
      COALESCE(SUM(cost_usd), 0.0) as total_cost_usd,
      COALESCE(SUM(token_input), 0) as total_token_input,
      COALESCE(SUM(token_output), 0) as total_token_output
    FROM tasks
    WHERE project_id = ?
  `).get(projectId) as MetricsSummary;

  return row;
}
