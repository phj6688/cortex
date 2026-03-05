# CORTEX V3 — FULL AUDIT REPORT

**Date:** 2026-03-05
**Auditor:** Claude Code
**Spec:** `CORTEX-V3-TASKSPEC.md`
**Status:** NOT WORKING — server build fails, ~25-30% of spec implemented

---

## 1. INVENTORY

| # | Path | Implements | Matches Spec? | Valid TS? | Issues |
|---|------|-----------|---------------|-----------|--------|
| 1 | `src/index.ts` | Fastify bootstrap, tRPC, CORS, routes | Partially | **NO** — TS2345 on `reply.redirect(302, url)` | Port 9348 instead of spec's 3481; no env validation with zod; no pino config; health endpoint missing db/ao connectivity check |
| 2 | `src/db/index.ts` | SQLite singleton, CRUD for projects/tasks/events | Partially | Yes | No prepared statements (builds SQL dynamically); missing `comments` table queries; missing `metrics` queries; missing `busy_timeout`/`cache_size` pragmas; `updated_at` column missing; no `total_cost_usd`/`task_count` on projects; no `priority`/`cost_usd`/`token_input`/`token_output`/`parent_task_id` fields |
| 3 | `src/db/schema.sql` | SQLite schema (projects, tasks, events) | **NO** | N/A | Missing: `comments` table, `CHECK` constraints on `state`/`event_type`, `priority`, `cost_usd`, `token_input`, `token_output`, `parent_task_id`, `updated_at`, `actor`/`from_state`/`to_state` on events, 4 indexes, 2 pragmas |
| 4 | `src/api/briefs.ts` | Brief refinement NDJSON streaming | Partially | Yes | Missing timeout/fallback logic (spec: 10s warning, 20s fallback); no Zod validation on request body (`as` cast); model hardcoded; no `estimated_complexity`/`suggested_project` in output |
| 5 | `src/api/events.ts` | SSE endpoint | Yes | Yes | Minor: missing `event:` field in SSE format |
| 6 | `src/lib/ao-adapter.ts` | AO dispatch + polling | **NO** | Yes | **Uses `exec()` with string interpolation** — spec Rule #9 forbids this. Must use `execFile()` with args array. Polls on intervals instead of webhooks. |
| 7 | `src/lib/event-bus.ts` | In-process pub/sub | Partially | Yes | Missing `cost_update`/`comment_added` event types; untyped; event IDs not prefixed |
| 8 | `src/lib/task-state.ts` | Task state machine | **NO** | Yes | **Transition rules wrong in 5+ places** vs spec (see details below) |
| 9 | `src/lib/task-state.test.ts` | Unit tests for state machine | Partially | Yes | Tests validate wrong transitions (matches code, not spec) |
| 10 | `src/router/index.ts` | tRPC app router composition | Yes | Yes | OK |
| 11 | `src/router/project.ts` | Project CRUD procedures | Partially | Yes | Missing `repo`/`path` as required create inputs; no `prj_` prefix on IDs |
| 12 | `src/router/task.ts` | Task CRUD + state transitions | Partially | Yes | No `tsk_` prefix on IDs; no transition guards; no DB event logging on state changes |
| 13 | `src/trpc/trpc.ts` | tRPC init | Yes | Yes | OK |
| 14 | `tsconfig.json` | TypeScript config | Partially | N/A | Target ES2022; missing `noUncheckedIndexedAccess` |
| 15 | `vitest.config.ts` | Vitest config | Yes | N/A | OK |
| 16 | `docker-compose.yml` | Docker orchestration | Partially | N/A | Port mapping inconsistent with spec |
| 17 | `Dockerfile` | Server Docker build | Partially | N/A | Uses `tsc` (spec says `tsup`); no biome |
| 18 | `web/src/app/layout.tsx` | Root layout | Partially | Yes | Uses Geist fonts (spec says Inter + JetBrains Mono) |
| 19 | `web/src/app/page.tsx` | Main page | **NO** | Yes | Not the spec's single-canvas 40/60 layout; components stacked vertically |
| 20 | `web/src/app/tasks/[id]/page.tsx` | Task detail page | **Not in spec** | Yes | Spec says ONE screen, NO page navigation |
| 21 | `web/src/components/AoDashboardEmbed.tsx` | AO iframe embed | Partially | Yes | Missing Framer Motion fullscreen animation |
| 22 | `web/src/components/BriefPanel.tsx` | Brief session tabs | Partially | Yes | Missing project selector, spec's chat-input structure |
| 23 | `web/src/components/BriefSession.tsx` | Brief refinement chat | **NO** | Yes | Auto-approves on sign-off (bypasses human review); no optimistic UI; no abort |
| 24 | `web/src/components/ErrorBoundary.tsx` | React error boundary | Yes | Yes | Missing recovery/retry button |
| 25 | `web/src/components/EventsSubscriber.tsx` | SSE → query invalidation | Not in spec | Yes | Invalidates ALL queries on every event; should be in hook |
| 26 | `web/src/components/ManualTaskForm.tsx` | Manual task creation | **Not in spec** | Yes | Spec has no manual form — tasks come from brief refinement |
| 27 | `web/src/components/TaskBoard.tsx` | Kanban-style columns | **NO** | Yes | Spec shows card grid, not kanban. Missing: filters, sort, cost, timeline, actions |
| 28 | `web/src/hooks/useTaskEvents.ts` | SSE hook with reconnect | Partially | Yes | 1.5x backoff (spec: 2x); untyped events; no zustand store |
| 29 | `web/src/lib/task-labels.ts` | State labels (client) | Yes | Yes | Duplicated from server (not shared); missing STATE_COLORS |
| 30 | `web/src/trpc/client.ts` | tRPC React client | Partially | Yes | Cross-package import via path alias (brittle) |
| 31 | `web/src/trpc/Provider.tsx` | tRPC + TanStack Query provider | Partially | Yes | Hardcoded fallback port 3481 but server runs on 9348 |

### Task State Machine Transition Errors (Detail)

| Transition | Spec | Code | Delta |
|-----------|------|------|-------|
| `draft →` | `['refined', 'sleeping']` | `['refined']` | Missing `sleeping` |
| `refined →` | `['pending_approval', 'draft', 'sleeping']` | `['pending_approval', 'draft']` | Missing `sleeping` |
| `pending_approval →` | `['approved', 'draft', 'sleeping']` | `['approved', 'refined']` | Wrong: `refined` instead of `draft`; missing `sleeping` |
| `approved →` | `['dispatched', 'draft']` | `['dispatched']` | Missing `draft` |
| `sleeping →` | `['draft']` | `['running', 'approved']` | **Completely wrong** |
| `failed →` | `['draft']` | `['approved']` | Wrong target |

---

## 2. DEPENDENCY CHECK

### Root `package.json`

| Dependency | In Spec? | Status |
|-----------|----------|--------|
| `@anthropic-ai/sdk ^0.32.0` | Yes | OK |
| `@fastify/cors ^10.0.0` | Yes | OK |
| `@trpc/server ^11.0.0` | Yes | OK |
| `better-sqlite3 ^11.6.0` | Yes | OK |
| `fastify ^5.0.0` | Yes | OK |
| `nanoid ^5.0.0` | Yes | OK |
| `zod ^3.24.0` | Yes | OK |
| `tsx ^4.19.0` (dev) | Yes | OK |
| `typescript ^5.7.0` (dev) | Yes | OK |
| `vitest ^2.1.0` (dev) | Yes | OK |
| `concurrently ^9.2.1` (dev) | Yes | OK |

**MISSING (required by spec):**

| Package | Purpose |
|---------|---------|
| `pino` | Structured logging |
| `tsup` | Build tool (currently using bare `tsc`) |
| `biome` | Lint + format (currently eslint in web) |
| `playwright` | E2E testing |

### Web `package.json`

| Dependency | In Spec? | Status |
|-----------|----------|--------|
| `@tanstack/react-query ^5` | Yes | OK |
| `@trpc/client ^11` | Yes | OK |
| `@trpc/react-query ^11` | Yes | OK |
| `next 16.1.6` | **NO** | Spec says Next.js **15**, installed **16** |
| `react 19` | OK | Compatible |
| `zustand ^5` | Yes | **Installed but never used** |
| `tailwindcss ^4` (dev) | Yes | OK |
| `eslint` (dev) | **NO** | Spec says Biome, not ESLint |

**MISSING (required by spec):**

| Package | Purpose |
|---------|---------|
| `framer-motion` | Exactly 4 animation uses |
| `shadcn/ui` | UI component library |
| `cmdk` | Command palette (⌘K) |
| `sonner` | Toast notifications |
| `@tanstack/react-virtual` | List virtualization |

**Engine mismatch:** `package.json` requires `node >=22`, system runs Node 20.20.0.

---

## 3. STRUCTURAL DIFF

### Matches Spec

```
package.json                    ✓ exists
tsconfig.json                   ✓ exists
docker-compose.yml              ✓ exists
Dockerfile                      ✓ exists
src/index.ts                    ✓ exists (wrong path: should be server/src/)
src/db/schema.sql               ✓ exists (incomplete)
src/api/briefs.ts               ✓ exists (renamed from routes/briefs.ts)
src/api/events.ts               ✓ exists (renamed from routes/sse.ts)
src/lib/task-state.ts           ✓ exists (renamed from domain/task-machine.ts)
src/lib/event-bus.ts            ✓ exists (renamed from services/event-bus.ts)
src/lib/ao-adapter.ts           ✓ exists (renamed from services/ao-dispatch.ts)
src/router/index.ts             ✓ exists
src/router/task.ts              ✓ exists
src/router/project.ts           ✓ exists
src/trpc/trpc.ts                ✓ exists
web/src/app/layout.tsx          ✓ exists
web/src/app/page.tsx            ✓ exists
web/src/app/globals.css         ✓ exists
web/src/hooks/useTaskEvents.ts  ✓ exists
web/src/trpc/client.ts          ✓ exists
```

### Exists but SHOULD NOT (not in spec)

```
web/src/app/tasks/[id]/page.tsx       ← spec says NO page navigation
web/src/components/ManualTaskForm.tsx  ← not in spec
web/src/components/EventsSubscriber.tsx ← should be in hook
web/eslint.config.mjs                 ← spec says Biome
web/pnpm-lock.yaml                    ← duplicate lockfile
web/pnpm-workspace.yaml               ← web is not a workspace root
```

### MISSING from Spec

```
SERVER:
  biome.json
  README.md
  CLAUDE.md
  server/src/env.ts                      ← Zod-validated env vars
  server/src/db/connection.ts            ← separate connection singleton
  server/src/db/migrate.ts               ← migration runner
  server/src/db/queries/tasks.ts         ← prepared statements
  server/src/db/queries/projects.ts
  server/src/db/queries/events.ts
  server/src/db/queries/metrics.ts       ← cost/duration aggregation
  server/src/domain/brief-schema.ts      ← Zod brief schema
  server/src/domain/vocabulary.ts        ← STATE_COLORS
  server/src/services/cost-tracker.ts    ← token cost tracking
  server/src/services/ao-status-poller.ts ← self-canceling poller
  server/src/routes/ao-webhook.ts        ← POST /api/ao-events
  server/src/routes/health.ts            ← proper health check
  server/src/lib/llm.ts                  ← Anthropic SDK wrapper
  server/src/lib/ndjson.ts               ← NDJSON helpers
  server/src/lib/id.ts                   ← prefixed ID generator (tsk_, prj_, evt_)
  server/tests/brief-refiner.test.ts
  server/tests/ao-dispatch.test.ts

CLIENT:
  web/components/canvas/mission-board.tsx
  web/components/canvas/command-bar.tsx   ← cmdk command palette
  web/components/brief/chat-input.tsx
  web/components/brief/refinement-stream.tsx
  web/components/brief/brief-card.tsx
  web/components/brief/brief-editor.tsx
  web/components/brief/project-selector.tsx
  web/components/brief/sign-off-button.tsx
  web/components/board/task-card.tsx
  web/components/board/task-list.tsx
  web/components/board/state-badge.tsx
  web/components/board/ao-dashboard.tsx
  web/components/board/task-actions.tsx
  web/components/board/task-timeline.tsx
  web/components/board/cost-indicator.tsx
  web/components/layout/top-bar.tsx
  web/components/layout/connection-status.tsx
  web/components/layout/skeleton.tsx
  web/components/projects/project-wizard.tsx
  web/components/projects/project-card.tsx
  web/components/shared/kbd.tsx
  web/components/shared/empty-state.tsx
  web/hooks/use-tasks.ts
  web/hooks/use-projects.ts
  web/hooks/use-keyboard.ts
  web/hooks/use-connection.ts
  web/stores/task-store.ts
  web/stores/ui-store.ts
  web/stores/connection-store.ts
  web/lib/api.ts                          ← NDJSON fetch helpers
  web/lib/format.ts                       ← date/duration/cost formatters
  web/lib/constants.ts                    ← theme tokens, timing
  web/public/sw.js                        ← service worker

CONFIG:
  ao-config/agent-orchestrator.yaml
```

---

## 4. RUNTIME CHECK

| Check | Result |
|-------|--------|
| `pnpm install` (root) | **WARN**: Node >=22 required, running 20. Installs OK. |
| `pnpm install` (web) | OK |
| `pnpm build` (server) | **FAILS** — `src/index.ts(40,25): TS2345: Argument of type 'number' is not assignable to parameter of type 'string'` (`reply.redirect(302, url)` wrong arg order) |
| `pnpm build` (web/Next.js) | **SUCCEEDS** — Turbopack, 4 routes generated |
| Server start | **BLOCKED** — build fails |
| `/health` endpoint | **UNTESTABLE** |
| Frontend renders | Builds static pages but depends on backend tRPC |
| `vitest run` | **UNTESTED** — server build failure blocks |

### Build Error Detail

```
src/index.ts(40,25): error TS2345: Argument of type 'number' is not assignable
to parameter of type 'string'.
```

Line 40: `return reply.redirect(302, process.env.WEB_URL ?? 'http://localhost:9301');`

Fastify 5's `reply.redirect()` signature is `redirect(url: string, code?: number)` — arguments are reversed.

---

## 5. DATABASE CHECK

**No database file exists** — `data/` directory is empty.

### Schema Gap Analysis (`src/db/schema.sql` vs spec)

| Spec Requirement | Present? |
|-----------------|----------|
| `PRAGMA busy_timeout = 5000` | **MISSING** |
| `PRAGMA cache_size = -20000` | **MISSING** |
| `CHECK(state IN (...))` on tasks | **MISSING** |
| `CHECK(event_type IN (...))` on events | **MISSING** |
| `priority INTEGER NOT NULL DEFAULT 0` | **MISSING** |
| `cost_usd REAL NOT NULL DEFAULT 0.0` | **MISSING** |
| `token_input INTEGER NOT NULL DEFAULT 0` | **MISSING** |
| `token_output INTEGER NOT NULL DEFAULT 0` | **MISSING** |
| `parent_task_id TEXT REFERENCES tasks(id)` | **MISSING** |
| `updated_at INTEGER` on tasks | **MISSING** |
| `total_cost_usd REAL` on projects | **MISSING** |
| `task_count INTEGER` on projects | **MISSING** |
| `updated_at INTEGER` on projects | **MISSING** |
| `from_state TEXT` on events | **MISSING** |
| `to_state TEXT` on events | **MISSING** |
| `actor TEXT` on events | **MISSING** |
| `comments` table | **MISSING** |
| `idx_tasks_parent` index | **MISSING** |
| `idx_tasks_priority` index | **MISSING** |
| `idx_events_type` index | **MISSING** |
| `idx_comments_task` index | **MISSING** |

---

## 6. VERDICT

### KEEP (2)

| Module | Notes |
|--------|-------|
| `src/router/index.ts` | Working, matches spec |
| `src/trpc/trpc.ts` | Working, matches spec |

### PATCH (10)

| Module | Fixes Needed |
|--------|-------------|
| `src/lib/event-bus.ts` | Add typed events, `cost_update`/`comment_added`, prefixed IDs |
| `src/api/briefs.ts` | Add Zod input validation, 10s/20s timeout/fallback, `estimated_complexity` |
| `src/api/events.ts` | Add `event:` field to SSE format |
| `src/router/task.ts` | Add `tsk_` prefix, transition guards, DB event logging |
| `src/router/project.ts` | Add `repo`/`path` required inputs, `prj_` prefix |
| `src/index.ts` | Fix redirect bug, add env validation, port 3481, health check, webhook route |
| `web/src/components/AoDashboardEmbed.tsx` | Add Framer Motion fullscreen |
| `web/src/components/ErrorBoundary.tsx` | Add recovery/retry button |
| `web/src/lib/task-labels.ts` | Add `STATE_COLORS` |
| `web/src/trpc/Provider.tsx` | Fix port mismatch |

### REWRITE (8)

| Module | Reason |
|--------|--------|
| `src/db/schema.sql` | Missing ~15 columns, 1 table, 4 indexes, CHECK constraints, pragmas |
| `src/db/index.ts` | Must split into connection + query modules per spec; missing fields |
| `src/lib/task-state.ts` | Transition rules wrong in 5+ places; missing guards |
| `src/lib/ao-adapter.ts` | Uses forbidden `exec()` with string interpolation; polling instead of webhooks |
| `web/src/app/page.tsx` | Not the spec's single-canvas 40/60 split layout |
| `web/src/components/TaskBoard.tsx` | Kanban columns instead of spec's card grid |
| `web/src/components/BriefPanel.tsx` + `BriefSession.tsx` | Auto-approves, no optimistic UI, wrong UX flow |
| `web/src/hooks/useTaskEvents.ts` | Untyped, wrong backoff, no zustand integration |

### DELETE (5)

| Module | Reason |
|--------|--------|
| `web/src/app/tasks/[id]/page.tsx` | Spec says NO page navigation — task detail is expandable panel |
| `web/src/components/ManualTaskForm.tsx` | Not in spec — tasks come from brief refinement |
| `web/src/components/EventsSubscriber.tsx` | Should be part of SSE hook |
| `web/eslint.config.mjs` | Spec says Biome, not ESLint |
| `web/pnpm-lock.yaml` + `pnpm-workspace.yaml` | Duplicate; should use root workspace |

### CREATE (~15 modules)

| Module | Purpose |
|--------|---------|
| `server/src/env.ts` | Zod-validated env vars, crash on missing |
| `server/src/db/queries/metrics.ts` | Cost + duration aggregation |
| `server/src/domain/brief-schema.ts` | Zod brief validation |
| `server/src/services/cost-tracker.ts` | Token cost calculation |
| `server/src/routes/ao-webhook.ts` | `POST /api/ao-events` webhook receiver |
| `server/src/lib/id.ts` | Prefixed nanoid (`tsk_`, `prj_`, `evt_`, `cmt_`) |
| `server/src/lib/llm.ts` | Anthropic SDK wrapper |
| `web/components/canvas/command-bar.tsx` | cmdk command palette |
| `web/components/board/task-card.tsx` | Animated task card |
| `web/components/board/state-badge.tsx` | Animated state indicator |
| `web/components/board/task-timeline.tsx` | Event timeline |
| `web/components/layout/top-bar.tsx` | Logo + connection status + shortcuts |
| `web/stores/task-store.ts` | Zustand: tasks + optimistic transitions |
| `web/stores/ui-store.ts` | Zustand: panel states, focus |
| `web/stores/connection-store.ts` | Zustand: SSE connection |
| `web/hooks/use-keyboard.ts` | Global keyboard shortcuts |
| `ao-config/agent-orchestrator.yaml` | AO configuration |
| `biome.json` | Lint + format config |

---

## Summary

The codebase is **~25-30% of what the spec requires**. Core domain logic (state machine, AO adapter, schema) has fundamental errors requiring rewrites. The frontend architecture diverges significantly from the spec's single-canvas design. Server build is currently broken due to a type error. No database exists yet.

**Critical blockers (must fix first):**
1. Server build failure (redirect type error)
2. State machine transitions are wrong
3. `exec()` shell injection vulnerability in ao-adapter
4. Schema missing ~15 columns and 1 table
