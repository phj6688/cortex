/**
 * Audit Service — dispatches audit agent via AO, parses structured JSON response.
 * @module services/audit-service
 */

import { dispatch, getStatus } from './ao-dispatch.js';
import { env } from '../env.js';
import type { TaskRow } from '../db/queries/tasks.js';
import type { ProjectRow } from '../db/queries/projects.js';

export interface AuditVerdict {
  file_path: string;
  verdict: 'keep' | 'patch' | 'rewrite' | 'delete' | 'create';
  reason: string;
  patch_details?: string;
}

export interface AuditSummary {
  keep: number;
  patch: number;
  rewrite: number;
  delete: number;
  create: number;
}

export interface AuditReport {
  verdicts: AuditVerdict[];
  summary: AuditSummary;
  critical_issues: string[];
  anti_patterns: string[];
}

const AUDIT_SYSTEM_PROMPT = `You are auditing an existing codebase against a specification.

For EVERY file in the project, produce a verdict:
- KEEP: Working, matches spec, no changes needed.
- PATCH: Mostly correct. List SPECIFIC fixes (line-level if possible).
- REWRITE: Fundamentally wrong approach. Explain why.
- DELETE: Not in spec, adds complexity. Explain why it should go.
- CREATE: Missing from spec. Describe what needs to be built.

Also produce:
- critical_issues: blockers that must be fixed before ANY building
- anti_patterns: specific mistakes in the old code that must NOT be repeated

Output ONLY valid JSON matching this schema:
{
  "verdicts": [{ "file_path": string, "verdict": "keep"|"patch"|"rewrite"|"delete"|"create", "reason": string, "patch_details"?: string }],
  "summary": { "keep": number, "patch": number, "rewrite": number, "delete": number, "create": number },
  "critical_issues": string[],
  "anti_patterns": string[]
}

No markdown. No explanation. Just the JSON.`;

/**
 * Parse raw audit output into an AuditReport.
 * @param output - Raw string output from the audit agent
 * @returns Parsed audit report
 */
function parseAuditReport(output: string): AuditReport {
  // Extract JSON from potentially wrapped output
  const jsonMatch = output.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in audit output');
  }

  const parsed = JSON.parse(jsonMatch[0]) as AuditReport;

  // Validate structure
  if (!Array.isArray(parsed.verdicts)) {
    throw new Error('Invalid audit report: missing verdicts array');
  }

  // Compute summary if not provided
  if (!parsed.summary) {
    parsed.summary = { keep: 0, patch: 0, rewrite: 0, delete: 0, create: 0 };
    for (const v of parsed.verdicts) {
      const key = v.verdict as keyof AuditSummary;
      if (key in parsed.summary) {
        parsed.summary[key]++;
      }
    }
  }

  parsed.critical_issues = parsed.critical_issues ?? [];
  parsed.anti_patterns = parsed.anti_patterns ?? [];

  return parsed;
}

/**
 * Wait for an AO session to complete, with timeout.
 * @param sessionId - AO session ID
 * @param timeoutMs - Maximum wait time
 * @returns Session output or throws on timeout
 */
async function waitForAuditCompletion(
  sessionId: string,
  timeoutMs: number,
): Promise<{ status: string; output: string }> {
  const deadline = Date.now() + timeoutMs;
  const pollInterval = 5_000;

  while (Date.now() < deadline) {
    const status = await getStatus(sessionId);
    if (status.status === 'done') {
      // Fetch the session output
      const aoBaseUrl = env.AO_BASE_URL;
      if (aoBaseUrl) {
        try {
          const res = await fetch(`${aoBaseUrl}/api/sessions/${sessionId}/output`, {
            signal: AbortSignal.timeout(10_000),
          });
          if (res.ok) {
            const data = (await res.json()) as { output: string };
            return { status: 'done', output: data.output ?? '' };
          }
        } catch {
          // Fall through
        }
      }
      return { status: 'done', output: '' };
    }
    if (status.status === 'failed') {
      return { status: 'failed', output: '' };
    }
    await new Promise((r) => setTimeout(r, pollInterval));
  }

  throw new Error('Audit timed out');
}

/**
 * Run a codebase audit for a task.
 * Dispatches an audit agent via AO that reads every file and produces structured verdicts.
 * @param task - The task being audited
 * @param project - The project to audit
 * @returns Audit report, or null if audit times out or fails
 */
export async function runAudit(
  task: TaskRow,
  project: ProjectRow,
): Promise<AuditReport | null> {
  const auditPrompt = [
    AUDIT_SYSTEM_PROMPT,
    '',
    '## SPECIFICATION',
    task.brief ?? task.raw_input,
    '',
    '## PROJECT',
    `Repo: ${project.repo}`,
    `Path: ${project.path}`,
    `Branch: ${project.default_branch}`,
    '',
    'Walk every file. Output the AuditReport JSON.',
  ].join('\n');

  try {
    // Create a synthetic task row for dispatch
    const auditTask: TaskRow = {
      ...task,
      brief: auditPrompt,
    };

    const result = await dispatch(auditTask);

    const completion = await waitForAuditCompletion(
      result.sessionId,
      env.DECOMPOSER_AUDIT_TIMEOUT,
    );

    if (completion.status === 'failed' || !completion.output) {
      return null;
    }

    return parseAuditReport(completion.output);
  } catch {
    // Audit timeout or failure — skip audit, decompose without it
    return null;
  }
}

/**
 * Create an empty audit report (for when audit is skipped).
 * @returns Empty audit report
 */
export function emptyAuditReport(): AuditReport {
  return {
    verdicts: [],
    summary: { keep: 0, patch: 0, rewrite: 0, delete: 0, create: 0 },
    critical_issues: [],
    anti_patterns: [],
  };
}
