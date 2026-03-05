# Cortex V3

AI task delegation control plane. Single-screen interface for intent, refinement, human sign-off, and agent execution with real-time feedback.

## Architecture

```
cortex-v3/
├── server/          Fastify 5 + tRPC v11 + SQLite (port 3481)
├── web/             Next.js 16 + Tailwind 4 + Zustand (port 9301)
├── e2e/             Playwright E2E tests
├── ao-config/       Agent Orchestrator configuration
└── docker-compose.yml
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, Tailwind CSS 4, Framer Motion, Zustand 5, cmdk |
| Backend | Fastify 5, tRPC v11, better-sqlite3 (WAL), Zod, pino |
| AI | Anthropic Claude SDK, Agent Orchestrator |
| Real-time | Server-Sent Events (SSE) |
| Testing | Vitest (121 unit tests), Playwright E2E |
| Tooling | TypeScript 5 (strict), Biome, tsup, pnpm workspaces |

## Task Lifecycle

```
draft → refined → pending_approval → approved → dispatched → running → done
                                       ↓ (large tasks)
                                   auditing → decomposing → dispatched
                                   (session-level execution with verification gates)
```

11 states, guard-validated transitions, decomposer flow for complex tasks with audit, session planning, sequential execution, and regression enforcement.

## Quick Start

```bash
# Prerequisites: Node.js >= 22, pnpm
pnpm install

# Development (starts both server + web)
pnpm dev

# Server: http://localhost:3481
# Web:    http://localhost:9301
```

## Scripts

```bash
pnpm dev          # Start server + web concurrently
pnpm build        # Production build (server + web)
pnpm test         # Run Vitest unit tests (121 tests)
pnpm typecheck    # TypeScript strict check (server + web)
pnpm lint         # Biome linter
pnpm test:e2e     # Playwright E2E tests
```

## Docker

```bash
docker compose up -d
```

Exposes port 3481. Requires `ANTHROPIC_API_KEY` in `.env`.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3481` | Server port |
| `DATABASE_PATH` | `./data/cortex.db` | SQLite database path |
| `WEB_URL` | `http://localhost:9301` | Frontend URL |
| `ANTHROPIC_API_KEY` | - | Claude API key |
| `AO_BASE_URL` | - | Agent Orchestrator endpoint |
| `LOG_LEVEL` | `info` | Logging level |
| `DECOMPOSER_ENABLED` | `true` | Enable task decomposer for large tasks |
| `DECOMPOSER_MAX_SESSIONS` | `8` | Max sessions per decomposed task |

## API

tRPC router at `/trpc/*` with batch support. SSE stream at `/api/events`. AO webhook at `/api/ao-events`. Health check at `/health`.

## Build History

| Session | Scope |
|---------|-------|
| 1-5 | Foundation, brief refinement, SSE, mission board, polish + command palette |
| 6 | Docker, AO config, projects |
| 7 | AO dispatch, webhook, status poller, E2E |
| 8a | Task decomposer: schema, state machine, services, tests |
| 8b | Decomposer UI: session progress, audit summary, actions |
| 8c | Decomposer E2E tests, type fixes |
