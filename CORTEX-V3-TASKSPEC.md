# CORTEX V3 — CLAUDE CODE TASK SPECIFICATION

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CORTEX V3 — AI TASK DELEGATION CONTROL PLANE
Target: /home/lumo/cortex-v3
DO NOT modify /home/lumo/cortex (old)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## MISSION

Build Cortex V3: a single-screen AI task delegation control plane with Apple-level polish.
Human writes intent → AI refines brief → Human signs off → Agent executes → Real-time feedback.
All execution delegated to ComposioHQ Agent Orchestrator (AO).
Inspired by Paperclip's UX: goal ancestry, cost tracking, ticket threading, governance.
Result: 10K-star-quality open-source project. Zero silent failures. Works perfectly.

---

## GROUND RULES

```
1.  Build in /home/lumo/cortex-v3. Never touch /home/lumo/cortex.
2.  Old Cortex stays on port 3480. New = port 3481. Cutover = nginx only.
3.  TypeScript strict mode. No `any`. No `ts-ignore`. No `as unknown as X`.
4.  Zero polling inside Cortex. All real-time = SSE push only.
5.  Every failure state has: human-readable reason + one next action button.
6.  No silent failures. Ever. Log every error. Surface every error.
7.  Framer Motion on exactly 4 things (listed below). CSS transitions elsewhere.
8.  NEVER innerHTML replacement in real-time render loops.
9.  NEVER exec() for shell commands. Always execFile() with args array.
10. NEVER leave user on a spinner with no escape hatch.
11. Every file < 300 lines. Split aggressively. One concern per file.
12. Every public function has JSDoc with @param and @returns.
13. All env vars validated at startup with zod. Crash on missing vars.
14. All API responses follow { success: boolean, data?: T, error?: string }.
15. Run `tsc --noEmit` after every session. Zero errors tolerated.
```

---

## STACK (non-negotiable)

### Backend
```
Node.js 25 | TypeScript 5.4+ strict
Fastify 5 (NOT Express)
better-sqlite3 (synchronous, NO ORM, NO Prisma, NO Drizzle)
tRPC v11 (procedures only — no REST except streaming endpoints)
SSE via reply.hijack() for real-time
Zod for all input validation
pino for structured logging
```

### Frontend
```
Next.js 16 App Router | TypeScript strict
Tailwind CSS v4 | shadcn/ui (latest)
Framer Motion 11 (exactly 4 uses)
Zustand (global state)
TanStack Query v5 (server state)
@tanstack/react-virtual (list virtualization)
cmdk (command palette)
sonner (toasts)
```

### Testing
```
Vitest (backend unit + integration)
Playwright (E2E critical paths)
```

### Dev Tooling
```
Biome (lint + format, NOT eslint + prettier)
tsx (dev runner)
tsup (build)
concurrently (dev scripts)
```

---

## DIRECTORY STRUCTURE

```
cortex-v3/
├── package.json
├── tsconfig.json
├── biome.json
├── docker-compose.yml
├── Dockerfile
├── README.md
├── CLAUDE.md                         # Agent rules for Claude Code
├── server/
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts                  # Fastify bootstrap + plugin registration
│   │   ├── env.ts                    # Zod-validated env vars (crash on invalid)
│   │   ├── db/
│   │   │   ├── connection.ts         # better-sqlite3 singleton + WAL pragmas
│   │   │   ├── schema.sql            # All CREATE TABLE + indexes
│   │   │   ├── migrate.ts            # Run schema.sql on startup if tables missing
│   │   │   └── queries/
│   │   │       ├── tasks.ts          # All task CRUD (prepared statements)
│   │   │       ├── projects.ts       # All project CRUD
│   │   │       ├── events.ts         # Append-only event log
│   │   │       └── metrics.ts        # Cost + duration aggregation queries
│   │   ├── domain/
│   │   │   ├── task-machine.ts       # State machine: transitions + guards
│   │   │   ├── brief-schema.ts       # Zod schema for refined briefs
│   │   │   └── vocabulary.ts         # State → human label mapping
│   │   ├── services/
│   │   │   ├── brief-refiner.ts      # LLM streaming brief refinement
│   │   │   ├── ao-dispatch.ts        # AO HTTP + CLI fallback
│   │   │   ├── ao-status-poller.ts   # Fallback 10s polling (self-canceling)
│   │   │   ├── event-bus.ts          # In-process pub/sub (typed events)
│   │   │   └── cost-tracker.ts       # Token usage aggregation per task/project
│   │   ├── routes/
│   │   │   ├── trpc.ts               # tRPC router (all procedures)
│   │   │   ├── sse.ts                # GET /api/events (non-async, hijack)
│   │   │   ├── briefs.ts             # POST /api/briefs/refine (NDJSON stream)
│   │   │   ├── ao-webhook.ts         # POST /api/ao-events (webhook receiver)
│   │   │   └── health.ts             # GET /health (db + ao connectivity)
│   │   └── lib/
│   │       ├── llm.ts                # Anthropic SDK wrapper (streaming)
│   │       ├── ndjson.ts             # NDJSON response helpers
│   │       └── id.ts                 # nanoid generator (prefixed: tsk_, prj_, evt_)
│   └── tests/
│       ├── task-machine.test.ts
│       ├── brief-refiner.test.ts
│       └── ao-dispatch.test.ts
├── web/
│   ├── tsconfig.json
│   ├── next.config.ts
│   ├── tailwind.config.ts
│   ├── app/
│   │   ├── layout.tsx                # Root layout (fonts, theme, providers)
│   │   ├── page.tsx                  # Single canvas — THE app
│   │   └── globals.css               # Tailwind imports + CSS vars + custom props
│   ├── components/
│   │   ├── canvas/
│   │   │   ├── brief-panel.tsx       # Left 40% — chat + brief + sign-off
│   │   │   ├── mission-board.tsx     # Right 60% — task cards + AO dashboard
│   │   │   └── command-bar.tsx       # cmdk command palette (⌘K)
│   │   ├── brief/
│   │   │   ├── chat-input.tsx        # Auto-resize textarea + submit
│   │   │   ├── refinement-stream.tsx # Live NDJSON token rendering
│   │   │   ├── brief-card.tsx        # Structured brief display
│   │   │   ├── brief-editor.tsx      # Manual edit fallback
│   │   │   ├── project-selector.tsx  # Inline project picker
│   │   │   └── sign-off-button.tsx   # Approve with optimistic UI
│   │   ├── board/
│   │   │   ├── task-card.tsx         # Individual task card (animated)
│   │   │   ├── task-list.tsx         # Virtualized task list
│   │   │   ├── state-badge.tsx       # Animated state indicator
│   │   │   ├── ao-dashboard.tsx      # Iframe with fullscreen toggle
│   │   │   ├── task-actions.tsx      # Context menu per task
│   │   │   ├── task-timeline.tsx     # Event timeline per task (audit log)
│   │   │   └── cost-indicator.tsx    # Token cost display per task
│   │   ├── layout/
│   │   │   ├── top-bar.tsx           # Logo + status + keyboard hints
│   │   │   ├── connection-status.tsx # SSE connection indicator
│   │   │   └── skeleton.tsx          # Skeleton screen components
│   │   ├── projects/
│   │   │   ├── project-wizard.tsx    # Add project (30-second flow)
│   │   │   └── project-card.tsx      # Project info display
│   │   └── shared/
│   │       ├── kbd.tsx               # Keyboard shortcut hint component
│   │       ├── empty-state.tsx       # Empty state with CTA
│   │       └── error-boundary.tsx    # React error boundary with recovery
│   ├── hooks/
│   │   ├── use-task-events.ts        # SSE subscription (100ms reconnect)
│   │   ├── use-tasks.ts              # TanStack Query + optimistic mutations
│   │   ├── use-projects.ts           # TanStack Query for projects
│   │   ├── use-keyboard.ts           # Global keyboard shortcuts
│   │   └── use-connection.ts         # SSE connection state
│   ├── stores/
│   │   ├── task-store.ts             # Zustand: tasks + optimistic transitions
│   │   ├── ui-store.ts               # Zustand: panel states, modals, focus
│   │   └── connection-store.ts       # Zustand: SSE connection status
│   ├── lib/
│   │   ├── trpc.ts                   # tRPC client setup
│   │   ├── api.ts                    # NDJSON fetch helpers
│   │   ├── format.ts                 # Date, duration, cost formatters
│   │   └── constants.ts              # Theme tokens, timing constants
│   └── public/
│       └── sw.js                     # Service worker (network-first HTML)
└── ao-config/
    └── agent-orchestrator.yaml       # AO configuration (managed by Cortex)
```

---

## DATA MODEL

### Task State Machine

```
             ┌──────────────────────────────────────────────────┐
             │                                                  │
  draft ──→ refined ──→ pending_approval ──→ approved ──→ dispatched ──→ running ──→ done
             │                │                │                │         │
             │                ↓                ↓                ↓         ↓
             │           sleeping          sleeping          failed    failed
             │                                                           │
             └──── (can return to draft from sleeping) ←─────────────────┘
```

### State Transition Rules (ENFORCE IN CODE)

```typescript
// server/src/domain/task-machine.ts
const VALID_TRANSITIONS: Record<TaskState, TaskState[]> = {
  draft:             ['refined', 'sleeping'],
  refined:           ['pending_approval', 'draft', 'sleeping'],
  pending_approval:  ['approved', 'draft', 'sleeping'],
  approved:          ['dispatched', 'draft'],
  dispatched:        ['running', 'failed'],
  running:           ['done', 'failed', 'sleeping'],
  sleeping:          ['draft'],
  done:              [],            // terminal
  failed:            ['draft'],     // can retry from scratch
} as const;

// Guard: failed REQUIRES failure_reason
// Guard: dispatched REQUIRES ao_session_id
// Guard: pending_approval REQUIRES project_id
// Guard: approved REQUIRES brief (non-empty)
```

### State Vocabulary (MANDATORY everywhere)

```typescript
// server/src/domain/vocabulary.ts
export const STATE_LABELS: Record<TaskState, string> = {
  draft:             'Writing...',
  refined:           'Ready to Review',
  pending_approval:  'Awaiting Sign-Off',
  approved:          'Queued',
  dispatched:        'Briefed',
  running:           'In the Field',
  sleeping:          'Standing By',
  done:              'Mission Complete',
  failed:            'Mission Failed',
} as const;

export const STATE_COLORS: Record<TaskState, string> = {
  draft:             '#6b7280', // gray
  refined:           '#f59e0b', // amber
  pending_approval:  '#f97316', // orange
  approved:          '#3b82f6', // blue
  dispatched:        '#8b5cf6', // violet
  running:           '#00ff41', // matrix green (pulse animation)
  sleeping:          '#64748b', // slate
  done:              '#10b981', // emerald
  failed:            '#ef4444', // red
} as const;
```

### SQLite Schema

```sql
-- server/src/db/schema.sql
-- Execute on EVERY connection open:
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;
PRAGMA cache_size = -20000;      -- 20MB cache

CREATE TABLE IF NOT EXISTS projects (
  id            TEXT PRIMARY KEY,   -- matches AO YAML project key
  name          TEXT NOT NULL,
  repo          TEXT NOT NULL,      -- org/repo format
  path          TEXT NOT NULL,      -- absolute path on host
  default_branch TEXT NOT NULL DEFAULT 'main',
  ao_config_json TEXT,              -- cached AO project config
  total_cost_usd REAL NOT NULL DEFAULT 0.0,
  task_count    INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at    INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS tasks (
  id            TEXT PRIMARY KEY,    -- prefixed: tsk_xxxxxxxx
  title         TEXT NOT NULL,       -- 8 words max
  brief         TEXT,                -- structured JSON brief
  raw_input     TEXT NOT NULL,       -- original chat message, NEVER modified
  project_id    TEXT REFERENCES projects(id),
  state         TEXT NOT NULL DEFAULT 'draft'
                CHECK(state IN ('draft','refined','pending_approval',
                                'approved','dispatched','running',
                                'sleeping','done','failed')),
  priority      INTEGER NOT NULL DEFAULT 0,  -- 0=normal, 1=high, 2=urgent
  ao_session_id TEXT,
  ao_branch     TEXT,
  ao_pr_url     TEXT,
  failure_reason TEXT,               -- REQUIRED when state='failed'
  cost_usd      REAL NOT NULL DEFAULT 0.0,
  token_input   INTEGER NOT NULL DEFAULT 0,
  token_output  INTEGER NOT NULL DEFAULT 0,
  parent_task_id TEXT REFERENCES tasks(id),  -- goal ancestry (Paperclip pattern)
  metadata      TEXT DEFAULT '{}',
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  approved_at   INTEGER,
  dispatched_at INTEGER,
  completed_at  INTEGER,
  updated_at    INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS events (
  id            TEXT PRIMARY KEY,    -- prefixed: evt_xxxxxxxx
  task_id       TEXT NOT NULL REFERENCES tasks(id),
  event_type    TEXT NOT NULL
                CHECK(event_type IN ('created','state_changed','brief_refined',
                                     'signed_off','dispatched','ao_update',
                                     'pr_opened','ci_passed','ci_failed',
                                     'done','failed','cost_update',
                                     'comment','retried','slept','woke')),
  from_state    TEXT,
  to_state      TEXT,
  payload       TEXT DEFAULT '{}',
  actor         TEXT DEFAULT 'system',  -- 'human' | 'system' | 'ao' | agent name
  created_at    INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS comments (
  id            TEXT PRIMARY KEY,    -- prefixed: cmt_xxxxxxxx
  task_id       TEXT NOT NULL REFERENCES tasks(id),
  author        TEXT NOT NULL,       -- 'human' | agent name
  body          TEXT NOT NULL,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tasks_state ON tasks(state);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_task ON events(task_id, created_at);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_comments_task ON comments(task_id, created_at);
```

---

## UI ARCHITECTURE — SINGLE CANVAS

```
ONE screen. NO page navigation. NO sidebar with 8 items.

┌─────────────────────────────────────────────────────────────────────────┐
│ TOP BAR: Logo · Connection Status · [N]ew · [⌘K] Command · Shortcuts  │
├────────────────────────┬────────────────────────────────────────────────┤
│   BRIEF PANEL (40%)    │          MISSION BOARD (60%)                  │
│                        │                                               │
│  ┌──────────────────┐  │  ┌─────────────────────────────────────────┐  │
│  │  Chat Input      │  │  │  Filter: All | Active | Done | Failed  │  │
│  │  (auto-resize)   │  │  │  Sort: Priority | Recent | State       │  │
│  └──────────────────┘  │  └─────────────────────────────────────────┘  │
│                        │                                               │
│  ┌──────────────────┐  │  ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│  │  AI Refinement   │  │  │ Task Card│ │ Task Card│ │ Task Card│     │
│  │  Stream          │  │  │ ┌──────┐ │ │ ┌──────┐ │ │ ┌──────┐ │     │
│  │  (live tokens)   │  │  │ │Badge │ │ │ │Badge │ │ │ │Badge │ │     │
│  └──────────────────┘  │  │ └──────┘ │ │ └──────┘ │ │ └──────┘ │     │
│                        │  │  Title   │ │  Title   │ │  Title   │     │
│  ┌──────────────────┐  │  │  Project │ │  Project │ │  Project │     │
│  │  Structured      │  │  │  Cost    │ │  Cost    │ │  Cost    │     │
│  │  Brief Card      │  │  │  Time    │ │  Time    │ │  Time    │     │
│  │                  │  │  │ [Actions]│ │ [Actions]│ │ [Actions]│     │
│  │  objective       │  │  └──────────┘ └──────────┘ └──────────┘     │
│  │  criteria        │  │                                               │
│  │  avoid areas     │  │  ┌─────────────────────────────────────────┐  │
│  └──────────────────┘  │  │  TASK DETAIL / AO DASHBOARD             │  │
│                        │  │  (expandable, Framer Motion)            │  │
│  ┌──────────────────┐  │  │  Timeline · Logs · Comments · PR Link   │  │
│  │  Project Selector│  │  └─────────────────────────────────────────┘  │
│  └──────────────────┘  │                                               │
│                        │  ┌─────────────────────────────────────────┐  │
│  ┌──────────────────┐  │  │  STATS BAR                              │  │
│  │  SIGN OFF ✓      │  │  │  Total: 24 | Running: 3 | Cost: $4.82  │  │
│  └──────────────────┘  │  └─────────────────────────────────────────┘  │
└────────────────────────┴────────────────────────────────────────────────┘
```

### Framer Motion — EXACTLY 4 Uses (CSS transitions everywhere else)

```
1. Task card enter/exit/reorder → AnimatePresence + layoutId on every card
2. Brief panel ↔ Task detail panel transitions
3. State badge color + scale pulse on status change
4. AO Dashboard / Task Detail fullscreen expand/collapse
```

### Theme

```css
/* web/app/globals.css */
:root {
  --bg-primary:    #0a0a0a;
  --bg-surface:    #141414;
  --bg-elevated:   #1a1a1a;
  --bg-brief:      #fafaf7;        /* Apple warmth for brief panel */
  --accent:        #00ff41;        /* matrix green */
  --accent-dim:    #00cc33;
  --accent-glow:   rgba(0, 255, 65, 0.15);
  --text-primary:  #f5f5f5;
  --text-secondary:#a1a1aa;
  --text-brief:    #1a1a1a;        /* dark text on cream brief */
  --border:        #262626;
  --border-focus:  #00ff41;
  --danger:        #ef4444;
  --warning:       #f59e0b;
  --success:       #10b981;

  --font-mono:     'JetBrains Mono', 'SF Mono', monospace;
  --font-sans:     'Inter', -apple-system, sans-serif;

  --radius-sm:     6px;
  --radius-md:     10px;
  --radius-lg:     16px;

  --shadow-card:   0 1px 3px rgba(0,0,0,0.4), 0 0 0 1px var(--border);
  --shadow-glow:   0 0 20px var(--accent-glow);

  --timing-fast:   150ms;
  --timing-normal: 250ms;
  --timing-slow:   400ms;
}
```

### Keyboard Shortcuts (IMPLEMENT ALL)

```
N          → Focus chat input (new brief)
⌘K / Ctrl+K → Command palette (cmdk)
Enter      → Sign off (when brief focused)
Escape     → Cancel / close panel / deselect
F          → Fullscreen AO Dashboard toggle
1-9        → Select task by position
R          → Retry failed task
S          → Sleep/wake toggle
?          → Show keyboard shortcuts overlay
```

---

## FEATURE 1: BRIEF REFINEMENT LOOP

### LLM Prompt Strategy

```typescript
// server/src/services/brief-refiner.ts
const SYSTEM_PROMPT = `You are a staff engineer receiving a task delegation.
Your job: produce a structured brief the executing agent can follow.

RULES:
- Ask 0–3 clarifying questions ONLY if they materially change execution.
- Frame as asking PERMISSION, not requesting specification.
  CORRECT: "Should I avoid touching the auth module?"
  INCORRECT: "What should I avoid?"
- If intent is already clear: skip questions, produce brief directly.
- Ops/infra tasks ALWAYS skip questions.
- Title: 8 words max.
- Objective: 2 sentences max.
- Acceptance criteria: measurable, testable.

OUTPUT (JSON):
{
  "questions": string[] | null,  // null = skip straight to brief
  "brief": {
    "title": string,
    "objective": string,
    "acceptance_criteria": string[],
    "avoid_areas": string[],
    "estimated_complexity": "trivial" | "small" | "medium" | "large",
    "suggested_project": string | null
  } | null  // null when questions are asked
}`;
```

### Streaming — NDJSON

```typescript
// server/src/routes/briefs.ts
// POST /api/briefs/refine
fastify.post('/api/briefs/refine', async (req, reply) => {
  const { input, context, project_id } = briefRefineSchema.parse(req.body);

  reply.hijack();
  const raw = reply.raw;
  raw.writeHead(200, {
    'Content-Type': 'application/x-ndjson',
    'Transfer-Encoding': 'chunked',
    'Cache-Control': 'no-cache',
    'X-Accel-Buffering': 'no',
  });

  const timeoutWarning = setTimeout(() => {
    raw.write(JSON.stringify({ type: 'warning', content: 'Taking longer than expected...' }) + '\n');
  }, 10_000);

  const timeoutFallback = setTimeout(() => {
    raw.write(JSON.stringify({ type: 'fallback', content: 'Could not reach AI — write brief manually' }) + '\n');
    raw.end();
  }, 20_000);

  try {
    const stream = await llm.stream(SYSTEM_PROMPT, buildUserMessage(input, context));
    let fullResponse = '';

    for await (const chunk of stream) {
      fullResponse += chunk;
      raw.write(JSON.stringify({ type: 'token', content: chunk }) + '\n');
    }

    clearTimeout(timeoutWarning);
    clearTimeout(timeoutFallback);

    const parsed = parseBriefResponse(fullResponse);
    raw.write(JSON.stringify({ type: 'complete', content: parsed }) + '\n');
  } catch (err) {
    clearTimeout(timeoutWarning);
    clearTimeout(timeoutFallback);
    raw.write(JSON.stringify({ type: 'error', content: String(err) }) + '\n');
  } finally {
    raw.end();
  }
});
```

### Client NDJSON Consumer

```typescript
// web/lib/api.ts
export async function* streamBriefRefinement(
  input: string,
  signal?: AbortSignal
): AsyncGenerator<BriefStreamEvent> {
  const res = await fetch('/api/briefs/refine', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input }),
    signal,
  });

  if (!res.ok || !res.body) throw new Error(`Refine failed: ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.trim()) continue;
      yield JSON.parse(line) as BriefStreamEvent;
    }
  }
}
```

### Concrete Behaviors (IMPLEMENT AND TEST)

**Example A — Clear intent, zero questions:**
```
Input: "Fix the bug where login button disappears on mobile Safari"
→ No questions. Direct brief:
  title: "Fix mobile Safari login bug"
  objective: "Login button invisible on Safari iOS. Restore without regressing other browsers."
  acceptance: ["Visible on Safari iOS 17+", "No regression Chrome/Firefox", "Screenshot proof"]
  avoid: []
  complexity: "small"
```

**Example B — One clarification:**
```
Input: "refactor the auth module"
→ Question: "Should I preserve the existing session token format, or is breaking
   backward compatibility with active sessions acceptable?"
[User: "preserve it"]
→ Brief:
  title: "Refactor auth, preserve tokens"
  objective: "Clean up auth internals. No JWT format changes. No active sessions invalidated."
  acceptance: ["All auth tests pass", "No JWT format changes", "Complexity reduced 30%+"]
  avoid: ["token signing logic", "session schema migrations"]
  complexity: "medium"
```

**Example C — Ops task (skip questions always):**
```
Input: "check why IRIS is returning 502 errors"
→ No questions (ops tasks always skip).
→ Brief:
  title: "Diagnose IRIS 502 errors"
  objective: "IRIS returning 502. Identify root cause, fix or escalate."
  acceptance: ["Root cause identified", "IRIS /health returns 200", "Incident summary written"]
  avoid: []
  complexity: "small"
  suggested_project: "ops-homelab"
```

---

## FEATURE 2: SSE REAL-TIME LAYER

```typescript
// server/src/routes/sse.ts
// CRITICAL: non-async handler, reply.hijack() REQUIRED
fastify.get('/api/events', (req, reply) => {
  reply.hijack();
  const raw = reply.raw;
  raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  raw.flushHeaders();

  // Heartbeat every 30s to keep connection alive
  const heartbeat = setInterval(() => {
    raw.write(`event: heartbeat\ndata: ${Date.now()}\n\n`);
  }, 30_000);

  const cleanup = eventBus.subscribe((event) => {
    raw.write(`id:${event.id}\nevent:${event.type}\ndata:${JSON.stringify(event)}\n\n`);
  });

  raw.once('close', () => { clearInterval(heartbeat); cleanup(); });
  raw.once('error', () => { clearInterval(heartbeat); cleanup(); });
});
```

### SSE Events (signals only — data via tRPC)

```typescript
type SSEEvent =
  | { type: 'task_created';        taskId: string }
  | { type: 'task_state_changed';  taskId: string; from: TaskState; to: TaskState }
  | { type: 'ao_update';           taskId: string; event: string }
  | { type: 'cost_update';         taskId: string; cost_usd: number }
  | { type: 'comment_added';       taskId: string; commentId: string }
  | { type: 'heartbeat';           timestamp: number };
```

### Client Hook — 100ms Reconnect Backoff

```typescript
// web/hooks/use-task-events.ts
export function useTaskEvents() {
  const reconnectDelay = useRef(100);
  const queryClient = useQueryClient();
  const setConnectionStatus = useConnectionStore(s => s.setStatus);

  useEffect(() => {
    let es: EventSource;
    let destroyed = false;

    function connect() {
      if (destroyed) return;
      es = new EventSource('/api/events');

      es.onopen = () => {
        reconnectDelay.current = 100;
        setConnectionStatus('connected');
      };

      es.onerror = () => {
        es.close();
        setConnectionStatus('reconnecting');
        if (!destroyed) {
          setTimeout(connect, reconnectDelay.current);
          reconnectDelay.current = Math.min(reconnectDelay.current * 2, 5000);
        }
      };

      es.addEventListener('task_state_changed', (e) => {
        const data = JSON.parse(e.data);
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
        queryClient.invalidateQueries({ queryKey: ['task', data.taskId] });
      });

      es.addEventListener('task_created', () => {
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
      });

      es.addEventListener('cost_update', (e) => {
        const data = JSON.parse(e.data);
        queryClient.invalidateQueries({ queryKey: ['task', data.taskId] });
        queryClient.invalidateQueries({ queryKey: ['metrics'] });
      });
    }

    connect();
    return () => { destroyed = true; es?.close(); };
  }, [queryClient, setConnectionStatus]);
}
```

---

## FEATURE 3: OPTIMISTIC UI

```typescript
// web/stores/task-store.ts
interface TaskStore {
  tasks: Map<string, Task>;
  optimisticTransition: (taskId: string, newState: TaskState) => () => void;
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: new Map(),

  optimisticTransition: (taskId, newState) => {
    const previous = get().tasks.get(taskId);
    if (!previous) return () => {};

    set(state => ({
      tasks: new Map(state.tasks).set(taskId, {
        ...previous,
        state: newState,
        updated_at: Math.floor(Date.now() / 1000),
      }),
    }));

    // Return rollback function
    return () => set(state => ({
      tasks: new Map(state.tasks).set(taskId, previous),
    }));
  },
}));

// Usage in sign-off:
async function handleSignOff(taskId: string) {
  const rollback = useTaskStore.getState().optimisticTransition(taskId, 'approved');
  try {
    await trpc.tasks.approve.mutate({ id: taskId });
    toast.success('Signed off — dispatching to agent');
  } catch (err) {
    rollback();
    toast.error('Sign-off failed — try again');
  }
}
```

---

## FEATURE 4: COMMAND PALETTE (⌘K)

```typescript
// web/components/canvas/command-bar.tsx
// Uses cmdk library. Commands:
const COMMANDS = [
  { id: 'new-brief',     label: 'New Brief',           shortcut: 'N',     action: () => focusChatInput() },
  { id: 'retry-failed',  label: 'Retry Failed Task',   shortcut: 'R',     action: () => retrySelected() },
  { id: 'sleep-task',    label: 'Sleep/Wake Task',     shortcut: 'S',     action: () => toggleSleep() },
  { id: 'fullscreen-ao', label: 'Toggle AO Dashboard', shortcut: 'F',     action: () => toggleAOFullscreen() },
  { id: 'add-project',   label: 'Add Project',         shortcut: '',      action: () => openProjectWizard() },
  { id: 'filter-active', label: 'Show Active Tasks',   shortcut: '',      action: () => setFilter('active') },
  { id: 'filter-failed', label: 'Show Failed Tasks',   shortcut: '',      action: () => setFilter('failed') },
  { id: 'shortcuts',     label: 'Keyboard Shortcuts',  shortcut: '?',     action: () => showShortcuts() },
];
```

---

## FEATURE 5: COST TRACKING (Paperclip-inspired)

```typescript
// server/src/services/cost-tracker.ts
// Track token usage per task, aggregate per project

interface CostUpdate {
  task_id: string;
  input_tokens: number;
  output_tokens: number;
  model: string;
}

// Pricing (update as needed):
const PRICING: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-5':  { input: 3.0 / 1_000_000,  output: 15.0 / 1_000_000 },
  'claude-haiku-3-5':   { input: 0.8 / 1_000_000,  output: 4.0 / 1_000_000 },
  'claude-opus-4':      { input: 15.0 / 1_000_000,  output: 75.0 / 1_000_000 },
};

export function calculateCost(update: CostUpdate): number {
  const rates = PRICING[update.model] ?? PRICING['claude-sonnet-4-5'];
  return (update.input_tokens * rates.input) + (update.output_tokens * rates.output);
}

// Called from:
// 1. Brief refinement (track LLM cost of refining)
// 2. AO webhook (track agent execution cost)
// Surface in UI: per-task cost badge, project totals, stats bar
```

---

## FEATURE 6: TASK TIMELINE (Audit Log)

```typescript
// Every state transition, every AO update, every comment → events table
// Rendered as a vertical timeline in task detail panel:

// web/components/board/task-timeline.tsx
// Shows:
// - State changes with from → to and timestamp
// - AO updates (CI status, PR opened, etc.)
// - Human comments
// - Cost accruals
// - Duration between states (e.g., "ran for 4m 32s")
```

---

## FAILURE MATRIX — IMPLEMENT EXACTLY

### 1. AO Dispatch Timeout
```
Condition: dispatched > 5min, no AO response
Badge:     "Mission Failed — Agent did not respond"
Actions:   [Retry Dispatch] [Edit Brief] [Sleep]
Auto:      Write event { type: 'failed', payload: { reason: 'dispatch_timeout' } }
```

### 2. AO CI Failure
```
Condition: AO webhook: ci-failed
Badge:     "Mission Failed — Tests failed after {N} retries"
Actions:   [View Logs] [Send Fix to Agent] [Edit Brief]
Auto:      Write event, store CI log URL in payload
```

### 3. SSE Disconnect During Sign-Off
```
Condition: SSE closes while approve mutation in flight
Toast:     "Connection lost — action may not have saved"
Recovery:  On SSE reconnect → refetch task state via tRPC immediately
Display:   Last confirmed state + "Reconnecting..." — NEVER spinner alone
```

### 4. Brief Refinement LLM Timeout
```
Condition: No first token within 10s
At 10s:    Warning: "Taking longer than expected..."
At 20s:    Fallback: "Could not reach AI — write brief manually"
           → Enable manual brief editor inline
           → NEVER leave user stuck on empty spinner
```

### 5. No Project at Sign-Off
```
Condition: User clicks Sign Off without project_id
Block:     Disable button. Inline message: "Select a project before signing off"
Display:   Project selector slides into brief panel — NO navigation away
```

### 6. AO Session Stuck
```
Condition: running > 30min with no AO heartbeat
Badge:     "Mission Failed — Agent session appears stuck"
Actions:   [Kill Session] [Retry] [Sleep]
Auto:      Try AO kill endpoint first, then mark failed
```

---

## AO INTEGRATION

### Config

```yaml
# ao-config/agent-orchestrator.yaml
dataDir: ~/.agent-orchestrator
worktreeDir: ~/.worktrees
port: 3000

defaults:
  runtime: process
  agent: claude-code
  workspace: worktree
  notifiers: [webhook]

projects:
  ops-homelab:
    name: Homelab Ops
    path: ~/homelab
    repo: phj6688/homelab-ops
    defaultBranch: main
    agentRules: |
      This is an operations/infrastructure task, not feature development.
      Do not open a PR unless explicitly asked.
      Report findings as a structured summary.
      SSH access available to 100.115.215.121.

notifiers:
  webhook:
    plugin: webhook
    to: http://cortex:3481/api/ao-events

notificationRouting:
  urgent: [webhook]
  action: [webhook]
  warning: [webhook]
  info: [webhook]
```

### Dispatch Service

```typescript
// server/src/services/ao-dispatch.ts
interface AODispatchService {
  dispatch(task: ApprovedTask): Promise<{ sessionId: string; branch: string }>;
  getStatus(sessionId: string): Promise<AOSessionStatus>;
  kill(sessionId: string): Promise<void>;
}

// v1 — HTTP (preferred):
async dispatch(task: ApprovedTask) {
  const res = await fetch(`${AO_BASE_URL}/api/spawn`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project: task.project_id,
      rules: formatBriefForAgent(task.brief),
      sessionId: task.id,
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`AO spawn failed: ${res.status}`);
  return res.json();
}

// v2 — CLI fallback (if /api/spawn returns 404):
// SAFE — execFile, args array, NO string interpolation:
import { execFile } from 'node:child_process';
execFile('ao', ['spawn', task.project_id, '--session-id', task.id, '--rules', briefPath]);
// NEVER: exec(`ao spawn ${project}`) ← shell injection
```

### Webhook Receiver

```typescript
// server/src/routes/ao-webhook.ts
// POST /api/ao-events
fastify.post('/api/ao-events', async (req, reply) => {
  const { sessionId, event, payload } = aoWebhookSchema.parse(req.body);

  const task = db.findTaskByAOSession(sessionId);
  if (!task) {
    logger.warn({ sessionId }, 'Webhook for unknown session');
    return reply.code(404).send({ error: 'Unknown session' });
  }

  const stateMap: Record<string, TaskState> = {
    'started':           'running',
    'pr-opened':         'running',   // update ao_pr_url
    'ci-passed':         'running',
    'ci-failed':         'failed',
    'done':              'done',
    'stuck':             'failed',
    'changes-requested': 'running',
  };

  const newState = stateMap[event];
  if (!newState) {
    logger.warn({ event }, 'Unknown AO event type');
    return reply.code(400).send({ error: 'Unknown event' });
  }

  // Transition + event log + SSE push (all in one transaction)
  db.transaction(() => {
    if (event === 'ci-failed' || event === 'stuck') {
      db.updateTask(task.id, {
        state: 'failed',
        failure_reason: payload?.reason ?? `Agent reported: ${event}`,
        completed_at: Math.floor(Date.now() / 1000),
      });
    } else if (event === 'done') {
      db.updateTask(task.id, {
        state: 'done',
        completed_at: Math.floor(Date.now() / 1000),
      });
    } else if (event === 'pr-opened') {
      db.updateTask(task.id, { ao_pr_url: payload?.url });
    } else {
      db.updateTask(task.id, { state: newState });
    }

    db.insertEvent({
      task_id: task.id,
      event_type: event === 'ci-failed' ? 'ci_failed' : event === 'pr-opened' ? 'pr_opened' : event,
      from_state: task.state,
      to_state: newState,
      payload: JSON.stringify(payload ?? {}),
      actor: 'ao',
    });
  });

  // SSE push
  eventBus.emit({
    id: nanoid(),
    type: 'task_state_changed',
    taskId: task.id,
    from: task.state,
    to: newState,
  });

  return reply.code(200).send({ ok: true });
});
```

---

## PROJECT SETUP UX (30 seconds max)

```
Step 1: ⌘K → "Add Project" (or button in brief panel)
Step 2: Paste GitHub repo URL → auto-parse org, repo name, infer path
Step 3: Select default branch (auto-detected from URL)
Step 4: Click "Add Project"
Step 5: Cortex writes YAML fragment to ao-config/. User NEVER sees YAML.
Done. < 30 seconds.
```

---

## DOCKER COMPOSE

```yaml
# docker-compose.yml
services:
  cortex-v3:
    build:
      context: .
      dockerfile: Dockerfile
    ports: ["3481:3481"]
    environment:
      DATABASE_PATH: /data/cortex.db
      AO_BASE_URL: http://agent-orchestrator:3000
      AO_CONFIG_PATH: /ao-config/agent-orchestrator.yaml
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      PORT: "3481"
      NODE_ENV: production
      LOG_LEVEL: info
    volumes:
      - cortex-v3-data:/data
      - ./ao-config:/ao-config
    depends_on: [agent-orchestrator]
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3481/health"]
      interval: 30s
      timeout: 5s
      retries: 3

  agent-orchestrator:
    image: composio/agent-orchestrator:latest
    ports: ["3000:3000"]
    volumes:
      - ./ao-config/agent-orchestrator.yaml:/root/.agent-orchestrator/agent-orchestrator.yaml
      - ao-data:/root/.agent-orchestrator
      - ao-worktrees:/root/.worktrees
    restart: unless-stopped

volumes:
  cortex-v3-data:
  ao-data:
  ao-worktrees:
```

### Dockerfile

```dockerfile
FROM node:25-slim AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY server/package.json server/
COPY web/package.json web/
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter server build && pnpm --filter web build

FROM node:25-slim AS runner
WORKDIR /app
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/package.json ./server/
COPY --from=builder /app/web/.next ./web/.next
COPY --from=builder /app/web/public ./web/public
COPY --from=builder /app/web/package.json ./web/
COPY --from=builder /app/node_modules ./node_modules
ENV NODE_ENV=production
EXPOSE 3481
CMD ["node", "server/dist/index.js"]
```

---

## UI QUALITY CHECKLIST (BUILD REQUIREMENTS)

```
□ NEVER innerHTML replacement in real-time render loops
□ All SSE handlers throttle at 300ms minimum
□ Zero loading spinners — skeleton screens with real dimensions only
□ Every button: disabled + loading state (both must exist)
□ Keyboard shortcuts: N, ⌘K, Enter, Esc, F, R, S, ?, 1-9
□ 44pt minimum touch targets (mobile)
□ Virtualize task list at >50 cards (@tanstack/react-virtual)
□ Service Worker: HTML = network-first | /assets/* = cache-first
□ Bump CACHE_NAME on every SW logic change
□ Optimistic UI on every state transition — rollback-function pattern
□ Every failure state: human reason + one next action button
□ Connection status indicator (top bar, always visible)
□ Empty states: illustrated with clear CTA (never blank screen)
□ Error boundaries: every panel has its own, with recovery button
□ Cost display: formatted as $X.XX, updated via SSE
□ Task cards: show elapsed time since last state change
□ Responsive: works on iPad (1024px min, fluid to 2560px)
□ Accessible: all interactive elements keyboard-navigable
□ Dark mode only (matches homelab aesthetic)
```

### Performance Targets

```
FCP           < 1.2s  (Lighthouse, production build)
Interaction   < 100ms (perceived latency)
First LLM     < 800ms (first token from refinement)
SSE reconnect < 500ms
Card reorder  = 60fps locked
Bundle size   < 200KB (first load JS, gzipped)
```

---

## CLAUDE.md (Agent Rules)

```markdown
# CORTEX V3 — Agent Rules

## Project
AI task delegation control plane. Single-screen app.
Backend: Fastify 5 + better-sqlite3 + tRPC v11
Frontend: Next.js 16 + Tailwind v4 + shadcn/ui

## Rules
1. TypeScript strict. No `any`. No `ts-ignore`.
2. Files < 300 lines. Split aggressively.
3. Every public function has JSDoc.
4. Use prepared statements for all SQL. Never string concatenation.
5. All env vars validated with zod at startup.
6. Run `tsc --noEmit` before committing. Zero errors.
7. Run `pnpm test` before committing. Zero failures.
8. Use nanoid with prefixes: tsk_, prj_, evt_, cmt_
9. All dates as unix timestamps (seconds, not milliseconds).
10. Never polling. SSE for real-time. tRPC for data.
11. State transitions MUST go through task-machine.ts.
12. Every DB mutation writes to events table (audit log).
13. Every user-facing string comes from vocabulary.ts.
```

---

## BUILD ORDER — 7 SESSIONS

### SESSION 1 — Foundation (MUST complete first)

```
DELIVERABLES:
├── Monorepo scaffolding (pnpm workspace, shared tsconfig)
├── server/src/env.ts (zod-validated env: PORT, DATABASE_PATH, AO_BASE_URL, ANTHROPIC_API_KEY)
├── server/src/db/connection.ts (better-sqlite3 singleton, WAL pragmas, busy_timeout)
├── server/src/db/schema.sql (all 4 tables, all indexes, all CHECK constraints)
├── server/src/db/migrate.ts (run schema.sql if tables missing, log migration status)
├── server/src/db/queries/ (all 4 query modules with prepared statements)
├── server/src/domain/task-machine.ts (transitions map, guards, validateTransition())
├── server/src/domain/vocabulary.ts (state labels + colors)
├── server/src/domain/brief-schema.ts (zod schema for Brief type)
├── server/src/services/event-bus.ts (typed in-process pub/sub)
├── server/src/lib/id.ts (nanoid with prefixes)
├── server/src/index.ts (Fastify 5 bootstrap, CORS, plugin registration)
├── server/src/routes/trpc.ts (tRPC router skeleton: tasks.list, tasks.get, tasks.create, tasks.approve, projects.list, projects.create, metrics.summary)
├── server/src/routes/health.ts (GET /health → { db: ok, uptime: seconds })
├── biome.json (lint + format config)
├── CLAUDE.md

VERIFICATION:
$ cd server && pnpm build       # zero errors
$ cd server && pnpm test        # task-machine tests pass
$ curl http://localhost:3481/health  # { "db": "ok" }
$ sqlite3 /data/cortex.db ".tables"  # projects tasks events comments
```

### SESSION 2 — Brief Refinement Loop (end-to-end before proceeding)

```
DELIVERABLES:
├── server/src/lib/llm.ts (Anthropic SDK wrapper, streaming, token counting)
├── server/src/lib/ndjson.ts (NDJSON response helpers)
├── server/src/services/brief-refiner.ts (system prompt, user message builder, response parser)
├── server/src/services/cost-tracker.ts (per-task cost calculation + DB update)
├── server/src/routes/briefs.ts (POST /api/briefs/refine — NDJSON stream with timeout handling)
├── web/ scaffolding (Next.js 16, Tailwind v4, shadcn/ui, fonts)
├── web/app/layout.tsx (JetBrains Mono + Inter fonts, theme CSS vars, providers)
├── web/app/globals.css (all CSS custom properties from theme spec)
├── web/lib/trpc.ts (tRPC client)
├── web/lib/api.ts (NDJSON stream consumer)
├── web/components/canvas/brief-panel.tsx (left 40%, cream background)
├── web/components/brief/chat-input.tsx (auto-resize, submit on Enter)
├── web/components/brief/refinement-stream.tsx (live token rendering)
├── web/components/brief/brief-card.tsx (structured brief display)
├── web/components/brief/brief-editor.tsx (manual fallback editor)
├── web/components/brief/project-selector.tsx (inline picker)
├── web/components/brief/sign-off-button.tsx (disabled states, loading)
├── Tests for all 3 example behaviors (A, B, C)

VERIFICATION:
$ Type "Fix the login bug on mobile Safari" → see tokens stream → see brief card
$ Type "refactor auth" → see clarifying question → answer → see brief
$ Type "check IRIS 502" → see immediate brief (no questions)
$ Wait 20s with no API key → see manual fallback editor
$ Sign off → task appears in DB with state=approved
```

### SESSION 3 — SSE Real-Time Layer

```
DELIVERABLES:
├── server/src/routes/sse.ts (non-async, hijack, heartbeat, cleanup)
├── web/hooks/use-task-events.ts (EventSource, 100ms backoff, typed events)
├── web/hooks/use-connection.ts (connection state hook)
├── web/stores/connection-store.ts (connected | reconnecting | disconnected)
├── web/components/layout/connection-status.tsx (green dot / yellow pulse / red)
├── tRPC invalidation on SSE signals
├── Heartbeat ping every 30s server-side
├── Tests: SSE connect, reconnect, event propagation

VERIFICATION:
$ Open two browser tabs → approve task in tab A → tab B updates instantly
$ Kill server → client shows "Reconnecting..." → restart → auto-reconnects < 500ms
$ Check: zero polling anywhere in codebase (grep for setInterval, setTimeout with fetch)
```

### SESSION 4 — Mission Board UI

```
DELIVERABLES:
├── web/app/page.tsx (CSS Grid: 40/60 split)
├── web/components/canvas/mission-board.tsx (right 60%)
├── web/components/board/task-card.tsx (animated, layoutId, all states)
├── web/components/board/task-list.tsx (virtualized with @tanstack/react-virtual)
├── web/components/board/state-badge.tsx (color + scale animation on change)
├── web/components/board/task-actions.tsx (context menu: retry, sleep, edit, archive)
├── web/components/board/task-timeline.tsx (event audit log per task)
├── web/components/board/cost-indicator.tsx ($X.XX per task)
├── web/components/board/ao-dashboard.tsx (iframe, fullscreen toggle with Framer Motion)
├── web/components/layout/top-bar.tsx (logo, connection, keyboard hints)
├── web/stores/task-store.ts (optimistic transitions)
├── web/stores/ui-store.ts (panel states, selected task, filters)
├── Filter bar: All | Active | Done | Failed | Standing By
├── Sort: Priority | Recent | State
├── Stats bar: Total | Running | Cost

VERIFICATION:
$ 50+ mock tasks render at 60fps (no jank on scroll)
$ Click task → detail panel expands with Framer Motion
$ Press F → AO dashboard goes fullscreen → press F again → collapses
$ Filter to "Failed" → only failed tasks shown
$ Each task shows elapsed time since last state change
```

### SESSION 5 — Polish + Failure Matrix + Command Palette

```
DELIVERABLES:
├── All 6 failure cases from failure matrix (exact behaviors above)
├── web/components/canvas/command-bar.tsx (cmdk, all commands listed above)
├── web/hooks/use-keyboard.ts (all shortcuts: N, ⌘K, Enter, Esc, F, R, S, ?, 1-9)
├── web/components/layout/skeleton.tsx (skeleton screens for every panel)
├── web/components/shared/empty-state.tsx (illustrated empty states)
├── web/components/shared/error-boundary.tsx (per-panel, with recovery)
├── web/public/sw.js (service worker: network-first HTML, cache-first assets)
├── Responsive layout: works at 1024px–2560px
├── All buttons: disabled + loading state
├── All touch targets: 44pt minimum
├── Keyboard shortcut overlay (? key)

VERIFICATION:
$ ⌘K opens command palette → type "new" → selects "New Brief" → chat input focused
$ Create task → kill AO → wait 5min → badge shows "Mission Failed — Agent did not respond"
$ Disconnect network → toast "Connection lost" → reconnect → state refetched
$ Every empty panel has illustrated empty state with CTA
$ Lighthouse: FCP < 1.2s, TTI < 2s
$ Session 2 end-to-end still works (regression)
```

### SESSION 6 — Docker + AO Config + Projects

```
DELIVERABLES:
├── docker-compose.yml (exact spec above)
├── Dockerfile (multi-stage, < 200MB image)
├── ao-config/agent-orchestrator.yaml (pre-seeded with ops-homelab)
├── server/ logic to read + write AO YAML programmatically
├── web/components/projects/project-wizard.tsx (paste URL → auto-populate → save)
├── web/components/projects/project-card.tsx
├── tRPC: projects.create (validates URL, writes YAML, inserts DB)
├── ops-homelab pre-seeded on first boot (migration)

VERIFICATION:
$ docker compose up → both services healthy
$ Open browser → add project via URL paste → project appears in selector
$ Check ao-config/agent-orchestrator.yaml → new project section exists
$ ops-homelab already in project selector on fresh DB
```

### SESSION 7 — AO Dispatch + End-to-End

```
DELIVERABLES:
├── server/src/services/ao-dispatch.ts (HTTP v1 + CLI v2 fallback)
├── server/src/services/ao-status-poller.ts (10s, self-canceling, fallback only)
├── server/src/routes/ao-webhook.ts (POST /api/ao-events → state update → SSE push)
├── Full dispatch pipeline: approved → dispatch → running → done/failed
├── Dispatch timeout detection (5min → mark failed)
├── AO session stuck detection (30min no heartbeat → mark failed)
├── Playwright E2E test: full path from brief → sign off → AO webhook → "Mission Complete"

VERIFICATION (end-to-end):
$ Type intent → AI refines → see brief → sign off → state shows "Queued"
$ AO spawns → webhook fires → state shows "In the Field" (green pulse)
$ AO completes → webhook fires → state shows "Mission Complete" (emerald)
$ Full Playwright test passes
$ `tsc --noEmit` = zero errors
$ `pnpm test` = zero failures
$ `pnpm build` = clean production build
```

---

## POST-BUILD: OPEN-SOURCE CHECKLIST

```
Before publishing to GitHub:
□ README.md with hero screenshot, quickstart, architecture diagram
□ LICENSE (MIT)
□ CONTRIBUTING.md
□ CHANGELOG.md
□ .github/workflows/ci.yml (typecheck + test + build)
□ .env.example (all required vars documented)
□ One-command setup: `npx cortex-v3 init` or `docker compose up`
□ Demo GIF in README (30-second recording of full flow)
□ Remove all hardcoded homelab references (make generic)
□ Strip all credentials from codebase (grep -r "password\|secret\|key")
```

---

*End of task specification. Every session must pass its verification checks before proceeding to the next.*