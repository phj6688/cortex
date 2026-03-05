/**
 * Read and write AO agent-orchestrator.yaml programmatically.
 * @module services/ao-config
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { env } from '../env.js';

interface AOProject {
  name: string;
  path: string;
  repo: string;
  defaultBranch: string;
  agentRules?: string;
}

interface AOConfig {
  raw: string;
  projects: Record<string, AOProject>;
}

function getConfigPath(): string {
  return env.AO_CONFIG_PATH ?? './ao-config/agent-orchestrator.yaml';
}

/** Read AO config and extract project entries. */
export function readAOConfig(): AOConfig | null {
  const configPath = getConfigPath();
  if (!existsSync(configPath)) return null;

  const raw = readFileSync(configPath, 'utf-8');
  const projects: Record<string, AOProject> = {};

  // Simple YAML parser for project entries (avoids yaml dep)
  const lines = raw.split('\n');
  let inProjects = false;
  let currentKey = '';
  let currentProject: Partial<AOProject> = {};
  let indent = 0;

  for (const line of lines) {
    const trimmed = line.trimStart();
    const lineIndent = line.length - trimmed.length;

    if (trimmed === 'projects:') {
      inProjects = true;
      indent = lineIndent;
      continue;
    }

    if (inProjects) {
      // New top-level key (not under projects)
      if (lineIndent <= indent && trimmed && !trimmed.startsWith('#') && trimmed.includes(':')) {
        if (currentKey && currentProject.name) {
          projects[currentKey] = currentProject as AOProject;
        }
        inProjects = false;
        continue;
      }

      // Project key (2-space indent under projects)
      if (lineIndent === indent + 2 && trimmed.endsWith(':') && !trimmed.includes(' ')) {
        if (currentKey && currentProject.name) {
          projects[currentKey] = currentProject as AOProject;
        }
        currentKey = trimmed.slice(0, -1);
        currentProject = {};
        continue;
      }

      // Project field
      if (currentKey && lineIndent >= indent + 4) {
        const match = trimmed.match(/^(\w+):\s*(.*)$/);
        if (match) {
          const [, key, value] = match;
          if (key === 'name') currentProject.name = value;
          if (key === 'path') currentProject.path = value;
          if (key === 'repo') currentProject.repo = value;
          if (key === 'defaultBranch') currentProject.defaultBranch = value;
        }
      }
    }
  }

  // Flush last project
  if (currentKey && currentProject.name) {
    projects[currentKey] = currentProject as AOProject;
  }

  return { raw, projects };
}

/** Append a new project to the AO config YAML. */
export function addProjectToAOConfig(key: string, project: AOProject): void {
  const configPath = getConfigPath();
  if (!existsSync(configPath)) return;

  const raw = readFileSync(configPath, 'utf-8');

  // Build YAML fragment
  let fragment = `\n  ${key}:\n`;
  fragment += `    name: ${project.name}\n`;
  fragment += `    path: ${project.path}\n`;
  fragment += `    repo: ${project.repo}\n`;
  fragment += `    defaultBranch: ${project.defaultBranch}\n`;
  if (project.agentRules) {
    fragment += `    agentRules: |\n`;
    for (const line of project.agentRules.split('\n')) {
      fragment += `      ${line}\n`;
    }
  }

  // Find the end of the projects section and insert before next top-level key
  const lines = raw.split('\n');
  let insertIndex = -1;
  let inProjects = false;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i]!.trimStart();
    const lineIndent = lines[i]!.length - trimmed.length;

    if (trimmed === 'projects:') {
      inProjects = true;
      continue;
    }

    if (inProjects && lineIndent === 0 && trimmed && !trimmed.startsWith('#')) {
      insertIndex = i;
      break;
    }
  }

  if (insertIndex === -1) {
    // Append at end of file
    writeFileSync(configPath, raw.trimEnd() + fragment, 'utf-8');
  } else {
    // Insert before the next section
    lines.splice(insertIndex, 0, ...fragment.trimEnd().split('\n'));
    writeFileSync(configPath, lines.join('\n'), 'utf-8');
  }
}
