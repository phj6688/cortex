/**
 * Decomposer Service — breaks large tasks into ordered sessions with verification gates.
 * @module services/decomposer-service
 */

import { env } from '../env.js';
import type { AuditReport } from './audit-service.js';
import type { ProjectRow } from '../db/queries/projects.js';

export interface SessionPlan {
  session_number: number;
  title: string;
  deliverables: string[];
  verification: string[];
  regression: string[];
  anti_patterns: string[];
  depends_on: number[];
}

const DECOMPOSE_SYSTEM_PROMPT = `You are a staff engineer decomposing a task into ordered build sessions.

Each session:
- Has a clear, scoped deliverable set
- Has verification commands that MUST pass before the next session starts
- Carries anti-patterns from the audit (mistakes the old code made)
- Includes regression checks from ALL prior sessions
- Is sized for a single Claude Code invocation (~30-60 min of agent work)

Rules:
- Session 1 is ALWAYS foundation (schema, types, core logic, tests)
- If audit found existing code, Session 1 must address KEEP/PATCH/REWRITE/DELETE
- Each session's verification must be runnable commands (not prose)
- Anti-patterns are injected as "DO NOT" instructions with specific old-code examples
- Max ${env.DECOMPOSER_MAX_SESSIONS} sessions. If the task needs more, it should be split into separate tasks.

Output ONLY valid JSON: an array of SessionPlan objects matching this schema:
[{
  "session_number": number,
  "title": string,
  "deliverables": string[],
  "verification": string[],
  "anti_patterns": string[],
  "depends_on": number[]
}]

No markdown. No explanation. Just the JSON array.`;

/**
 * Parse the LLM response into session plans.
 * @param response - Raw LLM output
 * @returns Array of session plans
 */
function parseSessionPlans(response: string): SessionPlan[] {
  // Extract JSON array from potentially wrapped output
  const jsonMatch = response.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error('No JSON array found in decomposition output');
  }

  const parsed = JSON.parse(jsonMatch[0]) as SessionPlan[];

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('Decomposition produced empty session list');
  }

  if (parsed.length > env.DECOMPOSER_MAX_SESSIONS) {
    throw new Error(`Decomposition produced ${parsed.length} sessions (max ${env.DECOMPOSER_MAX_SESSIONS})`);
  }

  // Ensure all sessions have required fields
  for (const s of parsed) {
    s.deliverables = s.deliverables ?? [];
    s.verification = s.verification ?? [];
    s.anti_patterns = s.anti_patterns ?? [];
    s.depends_on = s.depends_on ?? [];
    s.regression = []; // Will be populated below
  }

  return parsed;
}

/**
 * Build the user message for the decomposition LLM call.
 * @param briefJson - The task brief as JSON string
 * @param auditReport - Audit report (or null for greenfield)
 * @param project - Target project
 * @returns Formatted user message
 */
function buildDecomposeUserMessage(
  briefJson: string,
  auditReport: AuditReport | null,
  project: ProjectRow,
): string {
  const sections: string[] = [];

  sections.push('## BRIEF');
  sections.push(briefJson);
  sections.push('');

  if (auditReport && auditReport.verdicts.length > 0) {
    sections.push('## AUDIT REPORT');
    sections.push(JSON.stringify(auditReport, null, 2));
  } else {
    sections.push('## NO EXISTING CODE');
    sections.push('Greenfield project. No audit needed.');
  }
  sections.push('');

  sections.push('## PROJECT');
  sections.push(`Repo: ${project.repo}`);
  sections.push(`Path: ${project.path}`);
  sections.push('');

  sections.push('Decompose into ordered sessions. Output SessionPlan[] JSON.');

  return sections.join('\n');
}

/**
 * Decompose a task brief into ordered session plans using LLM.
 * @param briefJson - The task brief as JSON string
 * @param auditReport - Audit report (or null for greenfield)
 * @param project - Target project
 * @returns Array of session plans with regression chains populated
 */
export async function decompose(
  briefJson: string,
  auditReport: AuditReport | null,
  project: ProjectRow,
): Promise<SessionPlan[]> {
  const userMessage = buildDecomposeUserMessage(briefJson, auditReport, project);

  const anthropicUrl = env.ANTHROPIC_BASE_URL ?? 'https://api.anthropic.com';
  const apiKey = env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY required for decomposition');
  }

  const res = await fetch(`${anthropicUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20250514',
      max_tokens: 8192,
      system: DECOMPOSE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Decomposition LLM call failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as {
    content: Array<{ type: string; text?: string }>;
  };

  const textBlock = data.content.find((b) => b.type === 'text');
  if (!textBlock?.text) {
    throw new Error('No text response from decomposition LLM');
  }

  const sessions = parseSessionPlans(textBlock.text);

  // Inject regression chains: session N gets verification commands from sessions 1..N-1
  for (let i = 1; i < sessions.length; i++) {
    const session = sessions[i]!;
    session.regression = sessions
      .slice(0, i)
      .flatMap((s) => s.verification);
  }

  // Inject audit anti-patterns into all sessions if available
  if (auditReport?.anti_patterns && auditReport.anti_patterns.length > 0) {
    for (const s of sessions) {
      s.anti_patterns = [...new Set([...s.anti_patterns, ...auditReport.anti_patterns])];
    }
  }

  return sessions;
}
