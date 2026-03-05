/**
 * Project CRUD — prepared statements only.
 * @module db/queries/projects
 */

import { getDb } from '../connection.js';

export interface ProjectRow {
  id: string;
  name: string;
  repo: string;
  path: string;
  default_branch: string;
  ao_config_json: string | null;
  total_cost_usd: number;
  task_count: number;
  created_at: number;
  updated_at: number;
}

/**
 * List all projects.
 * @returns Array of project rows
 */
export function listProjects(): ProjectRow[] {
  return getDb().prepare('SELECT * FROM projects ORDER BY name').all() as ProjectRow[];
}

/**
 * Get a project by ID.
 * @param id - Project ID
 * @returns Project row or undefined
 */
export function getProject(id: string): ProjectRow | undefined {
  return getDb().prepare('SELECT * FROM projects WHERE id = ?').get(id) as ProjectRow | undefined;
}

/**
 * Create a new project.
 * @param data - Project creation data
 * @returns The created project
 */
export function createProject(data: {
  id: string;
  name: string;
  repo: string;
  path: string;
  default_branch?: string;
  ao_config_json?: string | null;
}): ProjectRow {
  const stmt = getDb().prepare(`
    INSERT INTO projects (id, name, repo, path, default_branch, ao_config_json)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    data.id,
    data.name,
    data.repo,
    data.path,
    data.default_branch ?? 'main',
    data.ao_config_json ?? null,
  );
  return getProject(data.id)!;
}

/**
 * Increment project task count.
 * @param id - Project ID
 * @returns void
 */
export function incrementTaskCount(id: string): void {
  getDb().prepare(
    'UPDATE projects SET task_count = task_count + 1, updated_at = unixepoch() WHERE id = ?'
  ).run(id);
}

/**
 * Add cost to a project.
 * @param id - Project ID
 * @param costUsd - Cost to add
 * @returns void
 */
export function addProjectCost(id: string, costUsd: number): void {
  getDb().prepare(
    'UPDATE projects SET total_cost_usd = total_cost_usd + ?, updated_at = unixepoch() WHERE id = ?'
  ).run(costUsd, id);
}
