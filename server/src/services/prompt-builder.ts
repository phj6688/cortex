/**
 * Prompt Builder — assembles full session prompts from spec + audit + anti-patterns.
 * This is the core: every section from the SESSION-8 spec must be present.
 * @module services/prompt-builder
 */

import type { SessionPlan } from './decomposer-service.js';
import type { TaskRow } from '../db/queries/tasks.js';
import type { AuditVerdictRow } from '../db/queries/audits.js';
import type { SessionRow } from '../db/queries/sessions.js';

/** Optional pre-fetched context to avoid DB calls (useful for testing). */
export interface PromptBuilderContext {
  auditVerdicts?: AuditVerdictRow[];
  sessionRecord?: SessionRow | null;
}

/**
 * Build the full prompt for a session dispatch.
 * Includes: spec reference, brief context, audit findings, anti-patterns,
 * deliverables, verification, regression, session context, failure context.
 * @param task - The parent task
 * @param session - The session plan being dispatched
 * @param allSessions - All session plans for context
 * @param ctx - Optional pre-fetched context (avoids DB calls)
 * @returns Full prompt string
 */
export function buildSessionPrompt(
  task: TaskRow,
  session: SessionPlan,
  allSessions: SessionPlan[],
  ctx?: PromptBuilderContext,
): string {
  const sections: string[] = [];

  // 1. Canonical spec reference
  sections.push(`# SESSION ${session.session_number}: ${session.title}`);
  sections.push('');
  sections.push('Read CORTEX-V3-TASKSPEC.md fully. It is the canonical spec.');
  sections.push('');

  // 2. Brief context
  let briefObj: {
    title?: string;
    objective?: string;
    acceptance_criteria?: string[];
    avoid_areas?: string[];
  } | null = null;
  try {
    briefObj = JSON.parse(task.brief ?? '{}');
  } catch {
    briefObj = null;
  }

  sections.push('## TASK BRIEF');
  if (briefObj) {
    if (briefObj.title) sections.push(`Title: ${briefObj.title}`);
    if (briefObj.objective) sections.push(`Objective: ${briefObj.objective}`);
    if (briefObj.acceptance_criteria && briefObj.acceptance_criteria.length > 0) {
      sections.push(`Acceptance Criteria: ${briefObj.acceptance_criteria.join(', ')}`);
    }
    if (briefObj.avoid_areas && briefObj.avoid_areas.length > 0) {
      sections.push(`Avoid: ${briefObj.avoid_areas.join(', ')}`);
    }
  } else {
    sections.push(task.brief ?? task.raw_input);
  }
  sections.push('');

  // 3. Audit findings (if available)
  let auditVerdicts: AuditVerdictRow[] = [];
  if (ctx?.auditVerdicts !== undefined) {
    auditVerdicts = ctx.auditVerdicts;
  } else {
    // Lazy import to avoid circular dependency and allow testing without DB
    try {
      const { getVerdictsByTask } = require('../db/queries/audits.js') as typeof import('../db/queries/audits.js');
      auditVerdicts = getVerdictsByTask(task.id);
    } catch {
      auditVerdicts = [];
    }
  }

  if (auditVerdicts.length > 0) {
    sections.push('## AUDIT FINDINGS');
    sections.push('An audit was performed on the existing codebase. Follow these verdicts:');
    sections.push('');
    for (const v of auditVerdicts) {
      sections.push(`- \`${v.file_path}\` → **${v.verdict.toUpperCase()}**: ${v.reason}`);
      if (v.verdict === 'patch' && v.patch_details) {
        sections.push(`  Fixes: ${v.patch_details}`);
      }
    }
    sections.push('');
  }

  // 4. Anti-patterns (CRITICAL — prevents repeating old mistakes)
  if (session.anti_patterns.length > 0) {
    sections.push('## ANTI-PATTERNS — DO NOT REPEAT THESE MISTAKES');
    sections.push('The previous implementation had these specific bugs. Do NOT reproduce them:');
    sections.push('');
    for (const ap of session.anti_patterns) {
      sections.push(`- DO NOT: ${ap}`);
    }
    sections.push('');
  }

  // 5. Deliverables
  sections.push('## DELIVERABLES');
  for (const d of session.deliverables) {
    sections.push(`- ${d}`);
  }
  sections.push('');

  // 6. Verification (what must pass)
  if (session.verification.length > 0) {
    sections.push('## VERIFICATION — ALL MUST PASS');
    for (const v of session.verification) {
      sections.push(`$ ${v}`);
    }
    sections.push('');
  }

  // 7. Regression (prior sessions' checks)
  if (session.regression.length > 0) {
    sections.push('## REGRESSION — PRIOR SESSIONS MUST STILL WORK');
    for (const r of session.regression) {
      sections.push(`$ ${r}`);
    }
    sections.push('');
  }

  // 8. Session context — what's already been completed
  const completedSessions = allSessions
    .filter((s) => s.session_number < session.session_number)
    .map((s) => `Session ${s.session_number} (${s.title}): PASSED`);

  if (completedSessions.length > 0) {
    sections.push('## COMPLETED SESSIONS');
    sections.push(completedSessions.join('\n'));
    sections.push('');
  }

  // 9. Failure context (if this is a retry)
  let sessionRecord: SessionRow | null | undefined = ctx?.sessionRecord;
  if (sessionRecord === undefined) {
    try {
      const { getSessionByNumber } = require('../db/queries/sessions.js') as typeof import('../db/queries/sessions.js');
      sessionRecord = getSessionByNumber(task.id, session.session_number) ?? null;
    } catch {
      sessionRecord = null;
    }
  }

  if (sessionRecord?.failure_reason) {
    sections.push('## PREVIOUS ATTEMPT FAILED');
    sections.push(`Reason: ${sessionRecord.failure_reason}`);
    if (sessionRecord.verification_output) {
      sections.push('');
      sections.push('Verification output:');
      sections.push(sessionRecord.verification_output);
    }
    sections.push('');
    sections.push('Fix the failure and ensure all verification checks pass.');
    sections.push('');
  }

  return sections.join('\n');
}
