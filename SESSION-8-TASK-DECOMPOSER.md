# CORTEX V3 — SESSION 8: TASK DECOMPOSER

```
POST-MVP FEATURE — Build after Sessions 1-7 are verified and shipping.
This is the system that made Sessions 0-4 of Cortex itself succeed.
```

---

## WHAT THIS IS

When a task is complex (`estimated_complexity: "large"`), Cortex decomposes it into ordered sessions with verification gates — then dispatches them sequentially through AO, injecting audit findings and anti-patterns into each session's agent rules.

This is the layer between Cortex's brief panel and AO's `ao spawn` that turns:

```
Brief → ao spawn (pray)
```

Into:

```
Brief → Audit codebase → Decompose into sessions → Spawn session 1 → Verify → Spawn session 2 → Verify → ... → Done
```

---

## WHY IT WORKS

The pattern that built Cortex itself:

1. **Spec as canonical truth** — one document that never changes during execution
2. **Audit before building** — structured KEEP/PATCH/REWRITE/DELETE verdict per module
3. **Session prompts carry anti-patterns** — each agent knows what the OLD code got wrong before writing a line
4. **Verification gates** — no session N+1 until session N's checks pass
5. **Regression enforcement** — every session re-verifies previous sessions

Without this, agents start from zero context every spawn. With it, agents are pre-armed against every known trap.

---

## DATA MODEL ADDITIONS

```sql
-- Add to schema.sql

CREATE TABLE IF NOT EXISTS task_sessions (
  id              TEXT PRIMARY KEY,         -- prefixed: ses_xxxxxxxx
  task_id         TEXT NOT NULL REFERENCES tasks(id),
  session_number  INTEGER NOT NULL,         -- 1, 2, 3...
  title           TEXT NOT NULL,            -- "Foundation", "Brief Refinement Loop"
  prompt          TEXT NOT NULL,            -- full prompt sent to agent (spec + audit + anti-patterns)
  deliverables    TEXT NOT NULL DEFAULT '[]', -- JSON array of expected outputs
  verification    TEXT NOT NULL DEFAULT '[]', -- JSON array of verification commands
  regression      TEXT NOT NULL DEFAULT '[]', -- JSON array of regression checks from prior sessions
  anti_patterns   TEXT NOT NULL DEFAULT '[]', -- JSON array of "do NOT repeat" warnings
  state           TEXT NOT NULL DEFAULT 'pending'
                  CHECK(state IN ('pending','auditing','ready','dispatched',
                                  'running','verifying','passed','failed','skipped')),
  ao_session_id   TEXT,
  audit_report    TEXT,                     -- raw audit output (populated after audit phase)
  verification_output TEXT,                 -- raw verification results
  failure_reason  TEXT,
  cost_usd        REAL NOT NULL DEFAULT 0.0,
  created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  started_at      INTEGER,
  completed_at    INTEGER
);

CREATE TABLE IF NOT EXISTS audit_verdicts (
  id              TEXT PRIMARY KEY,         -- prefixed: aud_xxxxxxxx
  task_id         TEXT NOT NULL REFERENCES tasks(id),
  file_path       TEXT NOT NULL,
  verdict         TEXT NOT NULL CHECK(verdict IN ('keep','patch','rewrite','delete','create')),
  reason          TEXT NOT NULL,
  patch_details   TEXT,                     -- specific fixes needed (for verdict=patch)
  created_at      INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_sessions_task ON task_sessions(task_id, session_number);
CREATE INDEX IF NOT EXISTS idx_sessions_state ON task_sessions(state);
CREATE INDEX IF NOT EXISTS idx_audits_task ON audit_verdicts(task_id);
```

### Task Session State Machine

```
pending → auditing → ready → dispatched → running → verifying → passed
                                                         ↓
                                                      failed → ready (retry with failure context appended)
```

---

## ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CORTEX BRIEF PANEL                          │
│  Human: "Rebuild the auth module with OAuth2 support"              │
│  Brief: complexity=large, 4 acceptance criteria, 2 avoid areas     │
│  [Sign Off] ────────────────────────────────────────────┐          │
└─────────────────────────────────────────────────────────┼──────────┘
                                                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      TASK DECOMPOSER SERVICE                        │
│                                                                     │
│  1. AUDIT PHASE (if code exists for this project)                  │
│     └─ ao send <session> "Read every file. Produce structured      │
│        KEEP/PATCH/REWRITE/DELETE verdict per module."               │
│     └─ Parse audit output → audit_verdicts table                   │
│                                                                     │
│  2. DECOMPOSITION PHASE                                            │
│     └─ LLM call: spec + brief + audit verdicts → ordered sessions  │
│     └─ Each session gets: deliverables, verification, anti-patterns│
│     └─ Write task_sessions rows                                    │
│                                                                     │
│  3. EXECUTION PHASE (sequential)                                   │
│     └─ For each session in order:                                  │
│        ├─ Build prompt: session spec + audit findings + anti-pats  │
│        ├─ ao spawn with generated prompt as rules                  │
│        ├─ Wait for AO completion webhook                           │
│        ├─ Run verification commands                                │
│        ├─ Run regression checks (all prior sessions)               │
│        ├─ If PASS → next session                                   │
│        └─ If FAIL → retry with failure output appended to prompt   │
│           (max 2 retries, then escalate to human)                  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## SERVICE IMPLEMENTATION

### 1. Audit Service

```typescript
// server/src/services/audit-service.ts

interface AuditVerdict {
  file_path: string;
  verdict: 'keep' | 'patch' | 'rewrite' | 'delete' | 'create';
  reason: string;
  patch_details?: string;
}

interface AuditReport {
  verdicts: AuditVerdict[];
  summary: {
    keep: number;
    patch: number;
    rewrite: number;
    delete: number;
    create: number;
  };
  critical_issues: string[];    // blockers that must be fixed first
  anti_patterns: string[];      // things the old code got wrong
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

Output ONLY valid JSON matching the AuditReport schema. No markdown. No explanation.`;

// Dispatch audit as an AO session that reads the codebase and returns structured JSON
async function runAudit(task: Task, project: Project): Promise<AuditReport> {
  const auditPrompt = [
    AUDIT_SYSTEM_PROMPT,
    '',
    '## SPECIFICATION',
    task.brief,
    '',
    '## PROJECT',
    `Repo: ${project.repo}`,
    `Path: ${project.path}`,
    `Branch: ${project.default_branch}`,
    '',
    'Walk every file. Output the AuditReport JSON.',
  ].join('\n');

  // Option A: Use AO to spawn audit agent
  const session = await aoDispatch.dispatch({
    project_id: project.id,
    rules: auditPrompt,
    id: generateId('ses'),
  });

  // Wait for completion (with 10min timeout for audit)
  const result = await waitForCompletion(session.sessionId, 600_000);
  return parseAuditReport(result.output);
}
```

### 2. Decomposer Service

```typescript
// server/src/services/decomposer-service.ts

interface SessionPlan {
  session_number: number;
  title: string;
  deliverables: string[];
  verification: string[];       // commands to run after session
  regression: string[];         // checks from all prior sessions
  anti_patterns: string[];      // injected from audit
  depends_on: number[];         // session numbers this depends on
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
- Max 8 sessions. If the task needs more, it should be split into separate tasks.

Output ONLY valid JSON: SessionPlan[]`;

async function decompose(
  brief: Brief,
  auditReport: AuditReport | null,
  project: Project,
): Promise<SessionPlan[]> {
  const userMessage = [
    '## BRIEF',
    JSON.stringify(brief, null, 2),
    '',
    auditReport ? '## AUDIT REPORT' : '## NO EXISTING CODE',
    auditReport ? JSON.stringify(auditReport, null, 2) : 'Greenfield project. No audit needed.',
    '',
    '## PROJECT',
    `Repo: ${project.repo}`,
    `Path: ${project.path}`,
    '',
    'Decompose into ordered sessions. Output SessionPlan[] JSON.',
  ].join('\n');

  const response = await llm.complete(DECOMPOSE_SYSTEM_PROMPT, userMessage);
  const sessions = parseSessionPlans(response);

  // Inject regression chains: session N gets verification from sessions 1..N-1
  for (let i = 1; i < sessions.length; i++) {
    sessions[i].regression = sessions
      .slice(0, i)
      .flatMap(s => s.verification);
  }

  return sessions;
}
```

### 3. Session Executor Service

```typescript
// server/src/services/session-executor.ts

async function executeSessionSequence(task: Task, sessions: SessionPlan[]): Promise<void> {
  for (const session of sessions) {
    const sessionRecord = db.getTaskSession(task.id, session.session_number);

    // Build the full prompt for this session
    const prompt = buildSessionPrompt(task, session, sessions);

    // Update state
    db.updateTaskSession(sessionRecord.id, { state: 'dispatched', started_at: now() });
    eventBus.emit({ type: 'session_state_changed', taskId: task.id, sessionId: sessionRecord.id });

    // Dispatch to AO
    const aoSession = await aoDispatch.dispatch({
      project_id: task.project_id!,
      rules: prompt,
      id: sessionRecord.id,
    });

    db.updateTaskSession(sessionRecord.id, {
      ao_session_id: aoSession.sessionId,
      state: 'running',
    });

    // Wait for AO completion
    const result = await waitForCompletion(aoSession.sessionId, 3600_000); // 1hr max

    if (result.status === 'failed') {
      await handleSessionFailure(task, sessionRecord, session, result);
      return; // stop sequence
    }

    // Run verification
    db.updateTaskSession(sessionRecord.id, { state: 'verifying' });
    const verifyResult = await runVerification(task, session);

    if (!verifyResult.passed) {
      // Retry with failure context (max 2 retries)
      const retried = await retryWithContext(task, sessionRecord, session, verifyResult);
      if (!retried) {
        escalateToHuman(task, sessionRecord, verifyResult);
        return;
      }
    }

    // Run regression checks
    if (session.regression.length > 0) {
      const regressionResult = await runRegression(task, session);
      if (!regressionResult.passed) {
        escalateToHuman(task, sessionRecord, regressionResult);
        return;
      }
    }

    db.updateTaskSession(sessionRecord.id, {
      state: 'passed',
      completed_at: now(),
      verification_output: JSON.stringify(verifyResult),
    });

    eventBus.emit({ type: 'session_state_changed', taskId: task.id, sessionId: sessionRecord.id });
  }

  // All sessions passed
  db.updateTask(task.id, { state: 'done', completed_at: now() });
  eventBus.emit({ type: 'task_state_changed', taskId: task.id, from: 'running', to: 'done' });
}
```

### 4. Prompt Builder

```typescript
// server/src/services/prompt-builder.ts
// This is where the magic happens — each session prompt is shaped by spec + audit + anti-patterns

function buildSessionPrompt(
  task: Task,
  session: SessionPlan,
  allSessions: SessionPlan[],
): string {
  const sections: string[] = [];

  // 1. Canonical spec reference
  sections.push(`# SESSION ${session.session_number}: ${session.title}`);
  sections.push('');
  sections.push('Read CORTEX-V3-TASKSPEC.md fully. It is the canonical spec.');
  sections.push('');

  // 2. Brief context
  const brief = JSON.parse(task.brief!);
  sections.push('## TASK BRIEF');
  sections.push(`Title: ${brief.title}`);
  sections.push(`Objective: ${brief.objective}`);
  sections.push(`Acceptance Criteria: ${brief.acceptance_criteria.join(', ')}`);
  if (brief.avoid_areas.length > 0) {
    sections.push(`Avoid: ${brief.avoid_areas.join(', ')}`);
  }
  sections.push('');

  // 3. Audit findings (if audit was run)
  const auditVerdicts = db.getAuditVerdicts(task.id);
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

  // 4. Anti-patterns (CRITICAL — this is what prevents repeating old mistakes)
  if (session.anti_patterns.length > 0) {
    sections.push('## ANTI-PATTERNS — DO NOT REPEAT THESE MISTAKES');
    sections.push('The previous implementation had these specific bugs. Do NOT reproduce them:');
    sections.push('');
    for (const ap of session.anti_patterns) {
      sections.push(`❌ ${ap}`);
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
  sections.push('## VERIFICATION — ALL MUST PASS');
  for (const v of session.verification) {
    sections.push(`$ ${v}`);
  }
  sections.push('');

  // 7. Regression (prior sessions' checks)
  if (session.regression.length > 0) {
    sections.push('## REGRESSION — PRIOR SESSIONS MUST STILL WORK');
    for (const r of session.regression) {
      sections.push(`$ ${r}`);
    }
    sections.push('');
  }

  // 8. Session context
  const completedSessions = allSessions
    .filter(s => s.session_number < session.session_number)
    .map(s => `Session ${s.session_number} (${s.title}): PASSED`);

  if (completedSessions.length > 0) {
    sections.push('## COMPLETED SESSIONS');
    sections.push(completedSessions.join('\n'));
    sections.push('');
  }

  // 9. Failure context (if this is a retry)
  const sessionRecord = db.getTaskSession(task.id, session.session_number);
  if (sessionRecord?.failure_reason) {
    sections.push('## PREVIOUS ATTEMPT FAILED');
    sections.push(`Reason: ${sessionRecord.failure_reason}`);
    sections.push('Fix the failure and ensure all verification checks pass.');
    sections.push('');
  }

  return sections.join('\n');
}
```

---

## UI ADDITIONS

### Session Progress Panel

Add to the task detail panel (Mission Board right side):

```
┌─────────────────────────────────────────────────────────────┐
│  TASK: Rebuild auth with OAuth2          [Mission Failed]   │
│                                                             │
│  Session Progress:                                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ✅ S1: Foundation          passed   12m  $0.42      │   │
│  │ ✅ S2: OAuth Provider      passed   18m  $0.67      │   │
│  │ ✅ S3: Token Management    passed    8m  $0.31      │   │
│  │ 🔴 S4: Session Migration   failed   14m  $0.53      │   │
│  │    └─ "3 regression tests from S2 broken"           │   │
│  │    └─ [Retry with context] [Edit session] [Skip]    │   │
│  │ ⏳ S5: E2E Tests           pending                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Total: $1.93 | Elapsed: 52m | 3/5 sessions passed         │
└─────────────────────────────────────────────────────────────┘
```

### New Components

```
web/components/board/session-progress.tsx    — vertical session list with states
web/components/board/session-detail.tsx      — expandable: prompt, output, verification results
web/components/board/session-actions.tsx     — retry / edit / skip per session
web/components/board/audit-summary.tsx       — KEEP/PATCH/REWRITE/DELETE breakdown card
```

### New SSE Events

```typescript
type SSEEvent =
  | ... // existing events
  | { type: 'session_state_changed'; taskId: string; sessionId: string; state: SessionState }
  | { type: 'audit_complete';        taskId: string; summary: AuditSummary }
  | { type: 'verification_result';   taskId: string; sessionId: string; passed: boolean }
```

---

## TASK STATE MACHINE UPDATE

When decomposer is active, the task state flow becomes:

```
approved → auditing → decomposing → dispatched → running → verifying → done
                                        ↑            ↓
                                        └── (next session if verification passed)

If complexity != "large": approved → dispatched → running → done (original flow, unchanged)
```

Add to `task-machine.ts`:

```typescript
// Extended transitions for decomposed tasks
const DECOMPOSED_TRANSITIONS: Record<string, string[]> = {
  approved:     ['auditing', 'dispatched'],  // auditing if large, direct dispatch if not
  auditing:     ['decomposing', 'failed'],
  decomposing:  ['dispatched', 'failed'],
  // dispatched/running/done same as before
};
```

---

## TRIGGER LOGIC

```typescript
// In the sign-off handler (server/src/routes/trpc.ts → tasks.approve)

async function handleApproval(taskId: string) {
  const task = db.getTask(taskId);
  const brief = JSON.parse(task.brief!);

  if (brief.estimated_complexity === 'large') {
    // Enter decomposer flow
    db.updateTask(taskId, { state: 'auditing' });
    eventBus.emit({ type: 'task_state_changed', taskId, from: 'approved', to: 'auditing' });

    // Run audit (async — SSE will push updates)
    const project = db.getProject(task.project_id!);
    const auditReport = await auditService.runAudit(task, project);

    // Store verdicts
    for (const v of auditReport.verdicts) {
      db.insertAuditVerdict({ task_id: taskId, ...v });
    }

    // Decompose
    db.updateTask(taskId, { state: 'decomposing' });
    const sessions = await decomposerService.decompose(brief, auditReport, project);

    // Create session records
    for (const s of sessions) {
      db.insertTaskSession({
        task_id: taskId,
        session_number: s.session_number,
        title: s.title,
        prompt: '', // built at dispatch time
        deliverables: JSON.stringify(s.deliverables),
        verification: JSON.stringify(s.verification),
        regression: JSON.stringify(s.regression),
        anti_patterns: JSON.stringify(s.anti_patterns),
        state: 'pending',
      });
    }

    // Start execution sequence
    await sessionExecutor.executeSessionSequence(task, sessions);

  } else {
    // Original flow: direct dispatch to AO
    await aoDispatch.dispatch(task);
  }
}
```

---

## CONFIGURATION

```typescript
// server/src/env.ts — add these

DECOMPOSER_ENABLED:       z.boolean().default(true),
DECOMPOSER_MAX_SESSIONS:  z.number().default(8),
DECOMPOSER_AUDIT_TIMEOUT: z.number().default(600_000),   // 10min
DECOMPOSER_SESSION_TIMEOUT: z.number().default(3600_000), // 1hr
DECOMPOSER_MAX_RETRIES:   z.number().default(2),
```

---

## FAILURE HANDLING

| Scenario | Behavior |
|----------|----------|
| Audit times out (>10min) | Skip audit, decompose without it, warn in UI |
| Decomposition fails | Fall back to single-session dispatch (original flow) |
| Session fails verification | Retry with failure output appended to prompt (max 2) |
| Session fails regression | Escalate to human — show which prior session broke |
| 2 retries exhausted | Mark session failed, stop sequence, surface to human with full context |
| Human clicks "Skip" on failed session | Mark skipped, continue to next session |
| Human clicks "Edit session" | Open session prompt in editor, re-dispatch on save |

---

## WHAT THIS ENABLES

1. **Any large Cortex task auto-decomposes** — human writes "rebuild auth with OAuth2", gets 5 ordered sessions with verification gates
2. **Audit findings travel with every session** — agent never repeats old mistakes
3. **Regression is enforced** — session 4 can't break what session 2 built
4. **Failed sessions get richer context on retry** — not just "try again" but "try again knowing THIS failed"
5. **Human stays in control** — skip, edit, retry, or take over at any session boundary
6. **Cost visibility per session** — know exactly which phase burned tokens

---

## BUILD ORDER

This is a 3-session addition (Sessions 8a, 8b, 8c):

### Session 8a — Schema + Services (backend)
```
- Add task_sessions and audit_verdicts tables to schema
- Add new states to task-machine.ts
- Build audit-service.ts, decomposer-service.ts, session-executor.ts, prompt-builder.ts
- Add task_sessions queries (CRUD + state transitions)
- Wire trigger logic in tasks.approve
- Tests: decomposition produces valid sessions, regression chains are correct, retry appends failure context
```

### Session 8b — UI (frontend)
```
- session-progress.tsx, session-detail.tsx, session-actions.tsx, audit-summary.tsx
- Wire new SSE events (session_state_changed, audit_complete, verification_result)
- Add session progress to task detail panel
- Retry / Edit / Skip actions per session
- Cost breakdown per session
```

### Session 8c — Integration + E2E
```
- Full flow: large task → audit → decompose → 3 sessions → verify → done
- Failure flow: session 2 fails → retry with context → passes
- Regression flow: session 3 breaks session 1's checks → escalate
- Small task flow still works (no decomposition, direct dispatch)
- Playwright E2E covering happy path + failure path
```