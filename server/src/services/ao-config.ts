/**
 * Read and write AO agent-orchestrator.yaml programmatically.
 * Uses the `yaml` package for correct nested object handling.
 * @module services/ao-config
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { parse, stringify } from 'yaml';
import { env } from '../env.js';

export interface AOProject {
  name: string;
  path: string;
  repo: string;
  defaultBranch: string;
  agentConfig?: { permissions: string };
  agentRules?: string;
}

interface AOConfigDoc {
  dataDir?: string;
  worktreeDir?: string;
  port?: number;
  defaults?: Record<string, unknown>;
  projects: Record<string, AOProject>;
  notifiers?: Record<string, unknown>;
  notificationRouting?: Record<string, unknown>;
}

function getConfigPath(): string {
  return env.AO_CONFIG_PATH ?? './ao-config/agent-orchestrator.yaml';
}

/** Read AO config and extract project entries. */
export function readAOConfig(): { raw: string; projects: Record<string, AOProject> } | null {
  const configPath = getConfigPath();
  if (!existsSync(configPath)) return null;

  const raw = readFileSync(configPath, 'utf-8');
  const doc = parse(raw) as AOConfigDoc | null;
  return { raw, projects: doc?.projects ?? {} };
}

/** Append a new project to the AO config YAML. */
export function addProjectToAOConfig(key: string, project: AOProject): void {
  const configPath = getConfigPath();
  if (!existsSync(configPath)) return;

  const raw = readFileSync(configPath, 'utf-8');
  const doc = parse(raw) as AOConfigDoc;

  if (!doc.projects) {
    doc.projects = {};
  }

  doc.projects[key] = {
    name: project.name,
    path: project.path,
    repo: project.repo,
    defaultBranch: project.defaultBranch,
    ...(project.agentConfig && { agentConfig: project.agentConfig }),
    ...(project.agentRules && { agentRules: project.agentRules }),
  };

  writeFileSync(configPath, stringify(doc, { lineWidth: 120 }), 'utf-8');
}
