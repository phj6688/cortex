# CORTEX V3 — CLAUDE CODE EXECUTION GUIDE (POST-AUDIT)

```
Generated: 2026-03-05
Audit status: COMPLETE — ~25-30% implemented, server broken, 8 rewrites needed
Decision: REBUILD with salvage (not patch)
Next.js: 16 (keep)
Node: 22 (upgrade before Session 1)
```

---

## PRE-REQUISITE: UPGRADE NODE TO 22

Run this BEFORE starting Session 1:

```bash
# On the Cortex host (homelab server):
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify:
node -v   # must show v22.x.x
npm -v    # must show 10.x.x

# Ensure pnpm is available:
corepack enable
pnpm -v
```

---

## SESSION 0 — DONE ✅

Audit complete. Report saved as `AUDIT-REPORT.md`.
Verdict: rebuild with salvage. Proceed to Session 1.

---

## SESSION 1 — FOUNDATION (REBUILD WITH SALVAGE)

Paste this EXACTLY into Claude Code:

```
Read CORTEX-V3-TASKSPEC.md fully. It is the canonical spec — every file path, every type, every pattern.

Read AUDIT-REPORT.md. It confirms this codebase is ~25-30% complete with fundamental errors.

We are doing a CONTROLLED REBUILD. Not a patch job. Here is the exact plan:

═══════════════════════════════════════
STEP 1: SALVAGE (copy to /tmp first)
═══════════════════════════════════════

Copy these to /tmp/cortex-v3-salvage/:
  KEEP AS-IS:
    src/router/index.ts        — tRPC app router composition (working)
    src/trpc/trpc.ts           — tRPC init (working)

  SALVAGE FOR REFERENCE (do NOT copy back directly — rewrite using these as hints):
    src/api/briefs.ts          — has NDJSON streaming structure, but missing timeouts
    src/api/events.ts          — has SSE pattern, missing event: field
    src/lib/event-bus.ts       — has pub/sub shape, but untyped
    src/router/task.ts         — has procedure structure, but no guards/prefixes
    src/router/project.ts      — has CRUD shape, missing fields
    web/src/app/layout.tsx     — has layout structure, wrong fonts
    web/src/components/AoDashboardEmbed.tsx — has iframe, missing Framer Motion
    web/src/trpc/client.ts     — has tRPC client setup
    web/src/trpc/Provider.tsx  — has provider, wrong port

═══════════════════════════════════════
STEP 2: DELETE EVERYTHING, PRESERVE GIT
═══════════════════════════════════════

Keep ONLY: .git/, CORTEX-V3-TASKSPEC.md, AUDIT-REPORT.md, CLAUDE-CODE-EXECUTION-GUIDE.md
Delete everything else in /home/lumo/cortex-v3/

═══════════════════════════════════════
STEP 3: SCAFFOLD FROM SPEC
═══════════════════════════════════════

Create the ENTIRE directory structure from the DIRECTORY STRUCTURE section of the spec.
Every directory, every file, exact paths. The spec uses:
  server/src/...   (NOT src/...)
  web/...          (NOT web/src/...)

NOTE ON NEXT.JS: Use Next.js 16 (not 15). The spec says 15 but we're keeping 16.
Adjust next.config.ts if any Next 16 breaking changes require it.

═══════════════════════════════════════
STEP 4: BUILD SESSION 1 — FOUNDATION
═══════════════════════════════════════

Build ALL of these from the spec. Do NOT copy old code — write fresh, referencing salvaged files only for structural hints:

1. package.json (pnpm workspace root)
   - Workspace: ["server", "web"]
   - Engine: node >=22
   - Scripts: dev, build, test, typecheck, lint

2. server/package.json
   - Dependencies: fastify 5, better-sqlite3, @trpc/server 11, zod, nanoid, pino, @anthropic-ai/sdk
   - Dev: tsx, tsup, vitest, @types/better-sqlite3
   - Build script: tsup
   - NOT tsc for build (audit found this wrong)

3. web/package.json
   - Dependencies: next 16, react 19, @trpc/client 11, @trpc/react-query 11, @tanstack/react-query 5, zustand 5, framer-motion 11, cmdk, sonner, @tanstack/react-virtual
   - Dev: tailwindcss 4, typescript, biome
   - NO eslint (audit found this — use biome)

4. biome.json (root level, shared)

5. server/src/env.ts
   - Zod schema: PORT (default 3481), DATABASE_PATH, AO_BASE_URL, ANTHROPIC_API_KEY, AO_CONFIG_PATH, LOG_LEVEL
   - Parse process.env at import time. Crash with readable error on missing required vars.

6. server/src/db/connection.ts
   - better-sqlite3 singleton
   - ALL pragmas: WAL, synchronous=NORMAL, foreign_keys=ON, busy_timeout=5000, cache_size=-20000
   - Audit found: busy_timeout and cache_size were MISSING. Include them.

7. server/src/db/schema.sql
   - FULL schema from spec. All 4 tables (projects, tasks, events, comments).
   - ALL CHECK constraints on state and event_type.
   - ALL columns the audit found missing: priority, cost_usd, token_input, token_output, parent_task_id, updated_at, total_cost_usd, task_count, from_state, to_state, actor.
   - ALL indexes (6 total).

8. server/src/db/migrate.ts
   - Run schema.sql on startup if tables don't exist.
   - Log migration status with pino.

9. server/src/db/queries/ (tasks.ts, projects.ts, events.ts, metrics.ts)
   - ALL use prepared statements. NEVER build SQL dynamically.
   - Audit found: old code built SQL dynamically. Do NOT do this.

10. server/src/domain/task-machine.ts
    - EXACT transition map from spec. The audit found 5+ wrong transitions in old code:
      * draft → MUST include 'sleeping' (was missing)
      * refined → MUST include 'sleeping' (was missing)
      * pending_approval → MUST go to 'draft' not 'refined', MUST include 'sleeping'
      * approved → MUST include 'draft' (was missing)
      * sleeping → MUST go to 'draft' ONLY (old code had 'running','approved' — COMPLETELY WRONG)
      * failed → MUST go to 'draft' ONLY (old code had 'approved' — WRONG)
    - Guards: failed REQUIRES failure_reason, dispatched REQUIRES ao_session_id, pending_approval REQUIRES project_id

11. server/src/domain/vocabulary.ts — state labels + colors from spec
12. server/src/domain/brief-schema.ts — Zod schema for Brief type
13. server/src/services/event-bus.ts — typed pub/sub with ALL event types including cost_update, comment_added
14. server/src/lib/id.ts — nanoid with prefixes: tsk_, prj_, evt_, cmt_
15. server/src/lib/llm.ts — Anthropic SDK wrapper (streaming)
16. server/src/lib/ndjson.ts — NDJSON response helpers

17. server/src/index.ts
    - Fastify 5 bootstrap with pino logger
    - Port 3481 (NOT 9348 — audit found wrong port)
    - CORS, plugin registration
    - Fix: old code had reply.redirect(302, url) with wrong arg order. Fastify 5 is redirect(url, code).

18. server/src/routes/trpc.ts — tRPC router: tasks.list, tasks.get, tasks.create, tasks.approve, projects.list, projects.create, metrics.summary
19. server/src/routes/health.ts — GET /health → { db: ok, uptime: seconds }

20. server/tests/task-machine.test.ts
    - Test ALL valid transitions
    - Test ALL invalid transitions are rejected
    - Test ALL guards (failure_reason, ao_session_id, project_id)

21. CLAUDE.md — agent rules from spec

22. tsconfig.json (root + server + web) — strict mode, noUncheckedIndexedAccess

═══════════════════════════════════════
STEP 5: COPY BACK KEEP FILES
═══════════════════════════════════════

From /tmp/cortex-v3-salvage/:
  - src/router/index.ts → server/src/routes/trpc.ts (adapt path + imports)
  - src/trpc/trpc.ts → server/src/trpc/trpc.ts (keep as-is if it fits new structure)

Only if they still compile after the restructure. If not, rewrite them.

═══════════════════════════════════════
STEP 6: VERIFY
═══════════════════════════════════════

Run ALL of these. Every one must pass:
  $ pnpm install                              # clean install
  $ cd server && pnpm build                   # tsup, zero errors
  $ cd server && pnpm test                    # vitest, task-machine tests pass
  $ cd server && pnpm start &                 # server starts on 3481
  $ curl -s localhost:3481/health | jq .      # { "db": "ok", "uptime": N }
  $ sqlite3 data/cortex.db ".tables"          # projects tasks events comments
  $ sqlite3 data/cortex.db "PRAGMA journal_mode" # wal
  $ cd .. && pnpm typecheck                   # tsc --noEmit, zero errors across workspace

Report:
- Which salvaged files were reused vs rewritten
- All verification results (pass/fail with output)
- Any decisions you made that deviate from spec (and why)
```

---

## SESSION 2 — BRIEF REFINEMENT LOOP

```
Read CORTEX-V3-TASKSPEC.md, sections "SESSION 2" and "FEATURE 1: BRIEF REFINEMENT LOOP".

Session 1 rebuilt the foundation. Now build the brief refinement end-to-end.

CONTEXT FROM AUDIT — things the old code got wrong that you must NOT repeat:
- Old briefs.ts had NO timeout/fallback handling (spec requires 10s warning, 20s manual fallback)
- Old code used `as` cast instead of Zod validation on request body
- Old code hardcoded the model string
- Old brief output was missing estimated_complexity and suggested_project fields
- Old BriefSession.tsx AUTO-APPROVED on sign-off, bypassing human review (spec requires explicit pending_approval state)
- Old code had no abort controller for canceling in-flight streams

Reference /tmp/cortex-v3-salvage/src/api/briefs.ts for the NDJSON streaming structure — it had the right shape but missing features. Do NOT copy it directly.

BUILD ALL SESSION 2 DELIVERABLES FROM SPEC:

SERVER:
  server/src/lib/llm.ts              — if not already complete from S1, finish it: Anthropic SDK, streaming, token counting
  server/src/lib/ndjson.ts           — NDJSON response helpers
  server/src/services/brief-refiner.ts — system prompt, user message builder, response parser
  server/src/services/cost-tracker.ts  — per-task cost calculation, DB update
  server/src/routes/briefs.ts        — POST /api/briefs/refine with NDJSON stream, timeout handling (10s + 20s)

FRONTEND:
  web/app/layout.tsx                 — JetBrains Mono + Inter fonts (NOT Geist — audit found wrong fonts), theme CSS vars, providers, Next.js 16
  web/app/globals.css                — ALL CSS custom properties from theme spec
  web/app/page.tsx                   — Single canvas, 40/60 CSS Grid split (for now just the left Brief Panel, right side placeholder)
  web/lib/trpc.ts                    — tRPC client setup (port 3481, NOT 9348)
  web/lib/api.ts                     — NDJSON stream consumer (async generator)
  web/components/canvas/brief-panel.tsx  — left 40%, cream background
  web/components/brief/chat-input.tsx    — auto-resize textarea, submit on Enter, abort button
  web/components/brief/refinement-stream.tsx — live NDJSON token rendering
  web/components/brief/brief-card.tsx    — structured brief display (title, objective, criteria, avoid)
  web/components/brief/brief-editor.tsx  — manual fallback editor (enabled at 20s timeout)
  web/components/brief/project-selector.tsx — inline project picker
  web/components/brief/sign-off-button.tsx  — disabled states, loading, EXPLICIT approval (NOT auto-approve)

TESTS:
  server/tests/brief-refiner.test.ts  — all 3 example behaviors (A: clear intent, B: one clarification, C: ops task)

VERIFY:
  $ Type "Fix the login bug on mobile Safari" → tokens stream live → brief card appears
  $ Type "refactor auth" → clarifying question appears → answer → brief card
  $ Type "check IRIS 502" → immediate brief, no questions (ops task)
  $ Disconnect ANTHROPIC_API_KEY → wait 20s → manual editor appears
  $ Sign off → task state becomes pending_approval (NOT approved — audit found auto-approve bug)
  $ Session 1 regression: curl localhost:3481/health still works, tsc --noEmit still passes
```

---

## SESSION 3 — SSE REAL-TIME LAYER

```
Read CORTEX-V3-TASKSPEC.md, sections "SESSION 3" and "FEATURE 2: SSE REAL-TIME LAYER".

AUDIT FINDINGS to avoid repeating:
- Old events.ts was missing the `event:` field in SSE format (just had `data:`)
- Old useTaskEvents.ts used 1.5x backoff (spec says 2x: Math.min(delay * 2, 5000))
- Old useTaskEvents.ts was untyped
- Old EventsSubscriber.tsx invalidated ALL queries on every event (wasteful)
- Old code had no Zustand store for connection state

BUILD:
  server/src/routes/sse.ts           — NON-async handler, reply.hijack(), heartbeat 30s, typed events with event: field
  web/hooks/use-task-events.ts       — EventSource, 100ms initial reconnect, 2x backoff, MAX 5000ms, typed events
  web/hooks/use-connection.ts        — connection state hook
  web/stores/connection-store.ts     — connected | reconnecting | disconnected
  web/components/layout/connection-status.tsx — green dot / yellow pulse / red

Wire SSE events to TanStack Query invalidation:
  task_state_changed → invalidate ['tasks'] + ['task', taskId]
  task_created → invalidate ['tasks']
  cost_update → invalidate ['task', taskId] + ['metrics']
  comment_added → invalidate ['task', taskId]

VERIFY:
  $ Open two browser tabs → approve task in tab A → tab B updates within 500ms
  $ Kill server → client shows "Reconnecting..." (yellow pulse) → restart → auto-reconnects
  $ grep -rn "setInterval\|setTimeout" web/src/ — NO polling patterns (only reconnect backoff is allowed)
  $ SSE stream includes `event:` field (not just `data:`)
  $ Regression: Session 1 + 2 still work
```

---

## SESSION 4 — MISSION BOARD UI

```
Read CORTEX-V3-TASKSPEC.md, section "SESSION 4".

AUDIT FINDINGS — the old frontend was fundamentally wrong:
- Old page.tsx stacked components vertically (spec: CSS Grid 40/60 horizontal split)
- Old TaskBoard.tsx was Kanban columns (spec: card grid with filters/sort)
- Old code had a tasks/[id]/page.tsx route (spec: NO page navigation, task detail is expandable panel)
- Zustand was installed but NEVER used (everything was in local state)
- framer-motion was NOT installed
- shadcn/ui was NOT installed
- @tanstack/react-virtual was NOT installed

DO NOT reference old frontend code. Build fresh from spec.

BUILD:
  Install: shadcn/ui (init + relevant components), framer-motion 11, @tanstack/react-virtual

  web/app/page.tsx                        — CSS Grid: 40% brief panel (from S2) + 60% mission board
  web/components/canvas/mission-board.tsx  — right 60% container
  web/components/board/task-card.tsx       — Framer Motion layoutId, all 9 states, cost badge, elapsed time
  web/components/board/task-list.tsx       — virtualized with @tanstack/react-virtual (>50 cards)
  web/components/board/state-badge.tsx     — animated color + scale pulse on state change
  web/components/board/task-actions.tsx    — context menu: retry, sleep, edit brief, archive
  web/components/board/task-timeline.tsx   — vertical event timeline per task (from events table)
  web/components/board/cost-indicator.tsx  — $X.XX formatted, updates via SSE
  web/components/board/ao-dashboard.tsx    — iframe, Framer Motion fullscreen toggle (press F)
  web/components/layout/top-bar.tsx        — logo, connection status, keyboard shortcut hints
  web/stores/task-store.ts                — Zustand: tasks Map, optimistic transitions with rollback
  web/stores/ui-store.ts                  — Zustand: selected task, panel state, filters, sort
  web/hooks/use-tasks.ts                  — TanStack Query: task list + single task queries
  web/hooks/use-projects.ts              — TanStack Query: project list

  Filter bar: All | Active | Done | Failed | Standing By
  Sort: Priority | Recent | State
  Stats bar: Total count | Running count | Total cost $X.XX

FRAMER MOTION — EXACTLY 4 uses only:
  1. Task card enter/exit/reorder (AnimatePresence + layoutId)
  2. Brief panel ↔ Task detail transitions
  3. State badge pulse on change
  4. AO Dashboard fullscreen expand/collapse
  Check: no other Framer Motion usage anywhere. CSS transitions for everything else.

VERIFY:
  $ Create 60 mock tasks → scroll at 60fps (no jank)
  $ Click task card → detail panel expands (Framer Motion)
  $ Press F → AO dashboard fullscreen → F again → collapses
  $ Filter "Failed" → only failed tasks
  $ Sort by Priority → urgent tasks first
  $ Stats bar shows correct totals
  $ Regression: type intent → stream → brief → sign off still works
```

---

## SESSION 5 — POLISH + FAILURE MATRIX + COMMAND PALETTE

```
Read CORTEX-V3-TASKSPEC.md, section "SESSION 5".

BUILD:
  web/components/canvas/command-bar.tsx  — cmdk: all commands from spec
  web/hooks/use-keyboard.ts             — ALL shortcuts: N, ⌘K, Enter, Esc, F, R, S, ?, 1-9
  web/components/layout/skeleton.tsx     — skeleton screens for brief panel, task list, task detail
  web/components/shared/empty-state.tsx  — illustrated empty states with CTA
  web/components/shared/kbd.tsx          — keyboard shortcut hint component
  web/components/shared/error-boundary.tsx — per-panel, with RECOVERY BUTTON (audit found this missing in old code)
  web/public/sw.js                       — service worker: network-first HTML, cache-first assets

FAILURE MATRIX — implement ALL 6 cases exactly:
  1. AO dispatch timeout (5min) → "Mission Failed — Agent did not respond" + [Retry] [Edit Brief] [Sleep]
  2. AO CI failure → "Mission Failed — Tests failed after N retries" + [View Logs] [Send Fix] [Edit Brief]
  3. SSE disconnect during sign-off → toast + refetch on reconnect + show last confirmed state
  4. Brief LLM timeout → 10s warning + 20s manual fallback
  5. No project at sign-off → block button, inline "Select a project", show selector
  6. AO session stuck (30min) → "Agent session appears stuck" + [Kill] [Retry] [Sleep]

POLISH:
  □ Every button: disabled + loading states (both)
  □ All touch targets: 44pt minimum
  □ Zero spinners — skeletons only
  □ Every empty panel: illustrated empty state
  □ Error boundary on every panel
  □ Keyboard shortcut overlay (? key)
  □ Responsive: 1024px–2560px

VERIFY:
  $ ⌘K opens command palette → type "new" → "New Brief" selected → chat focused
  $ Press ? → shortcut overlay appears
  $ All 6 failure cases manually tested
  $ Lighthouse production build: FCP < 1.2s
  $ FULL REGRESSION: type intent → stream → brief → sign off → task on board → detail panel
```

---

## SESSION 6 — DOCKER + AO CONFIG + PROJECTS

```
Read CORTEX-V3-TASKSPEC.md, section "SESSION 6".

AUDIT FOUND: old docker-compose.yml had wrong port mapping. Old Dockerfile used tsc instead of tsup.

BUILD:
  docker-compose.yml                     — exact spec (port 3481, healthcheck, depends_on)
  Dockerfile                             — multi-stage, tsup build, < 200MB image
  ao-config/agent-orchestrator.yaml      — pre-seeded with ops-homelab
  server/ logic to read + write AO YAML  — Cortex manages YAML programmatically
  web/components/projects/project-wizard.tsx — paste GitHub URL → auto-parse → 30 seconds
  web/components/projects/project-card.tsx
  tRPC: projects.create                  — validates URL, writes YAML fragment, inserts DB
  Migration: ops-homelab pre-seeded on first boot

VERIFY:
  $ docker compose build                  # succeeds, image < 200MB
  $ docker compose up -d                  # both services healthy within 30s
  $ curl localhost:3481/health            # { db: ok }
  $ Open browser → paste GitHub URL → project appears in selector
  $ Check ao-config/agent-orchestrator.yaml → new project section written
  $ Fresh DB → ops-homelab already in project selector
```

---

## SESSION 7 — AO DISPATCH + END-TO-END

```
Read CORTEX-V3-TASKSPEC.md, section "SESSION 7".

AUDIT FOUND: old ao-adapter.ts used exec() with string interpolation — SHELL INJECTION VULNERABILITY.
Old code polled AO on intervals instead of using webhooks. REWRITE completely.

BUILD:
  server/src/services/ao-dispatch.ts     — HTTP v1 (fetch + AbortSignal.timeout) + CLI v2 fallback (execFile ONLY)
  server/src/services/ao-status-poller.ts — 10s interval, ONLY for dispatched|running, self-cancels on terminal state
  server/src/routes/ao-webhook.ts        — POST /api/ao-events → find task → update state → write event → SSE push
  Dispatch timeout: dispatched >5min with no response → mark failed
  Stuck detection: running >30min with no AO heartbeat → mark failed
  Playwright E2E test: full path

VERIFY (end-to-end):
  $ Type intent → AI refines → brief card → sign off
  $ State: "Queued" → "Briefed" (dispatch) → "In the Field" (running, green pulse)
  $ AO webhook fires done → "Mission Complete" (emerald)
  $ Playwright test passes
  $ tsc --noEmit = zero errors across entire workspace
  $ pnpm test = zero failures
  $ pnpm build = clean production build
  $ docker compose up = both services healthy
  $ grep -rn "exec(" server/src/ — ZERO results (only execFile allowed)
```

---

## BETWEEN EVERY SESSION — YOU VERIFY

```bash
cd /home/lumo/cortex-v3

# Type safety
pnpm typecheck                     # tsc --noEmit, zero errors

# Tests
pnpm test                          # vitest, zero failures

# Build
pnpm build 2>&1 | tail -10         # clean build

# Server (after S1+)
curl -s localhost:3481/health | jq .

# Brief flow (after S2+)
# Manual: type intent → see stream → see brief → sign off

# SSE (after S3+)
# Manual: two tabs, verify cross-tab updates

# Security (after S7)
grep -rn "exec(" server/src/       # must be ZERO (only execFile)
grep -rn "as any" server/src/      # must be ZERO
grep -rn "ts-ignore" server/src/   # must be ZERO
```

---

## IF CLAUDE CODE GOES OFF-RAILS

Watch for these specific patterns (from audit learnings):

```
❌ Uses exec() instead of execFile()     → "STOP. Spec rule #9. Use execFile with args array."
❌ Makes SSE handler async               → "STOP. SSE handler MUST be non-async. Read spec FEATURE 2."
❌ Builds SQL dynamically                → "STOP. Use prepared statements. Read spec SESSION 1 item 9."
❌ Skips transition guards               → "STOP. Read task-machine.ts spec. Guards are mandatory."
❌ Auto-approves on sign-off             → "STOP. Sign-off → pending_approval, NOT approved. Read spec."
❌ Uses wrong port (9348)                → "STOP. Port is 3481. Read env.ts spec."
❌ Installs eslint                       → "STOP. Biome only. No eslint."
❌ Creates page routes                   → "STOP. Single canvas. NO page navigation."
❌ Uses Geist fonts                      → "STOP. JetBrains Mono + Inter. Read theme spec."
❌ Adds >4 Framer Motion uses            → "STOP. Exactly 4 uses. Read spec."
```

Corrective prompt template:
```
STOP. You diverged from CORTEX-V3-TASKSPEC.md.

Violation: [describe exactly what went wrong]
Spec reference: [section name]
Correct behavior: [what the spec says]

Revert your last change and follow the spec.
```

---

## TIMELINE

```
Pre-req (Node 22):    5 min
Session 0 (Audit):    ✅ DONE
Session 1 (Foundation): 45-60 min (rebuild from scratch)
Session 2 (Brief):      45-60 min
Session 3 (SSE):        20-30 min
Session 4 (Board UI):   45-60 min
Session 5 (Polish):     45-60 min
Session 6 (Docker):     30-45 min
Session 7 (E2E):        45-60 min
────────────────────────────────────
Total:                  ~5-6 hours of Claude Code time
```

One session per Claude Code invocation. Verify between each. Don't chain.