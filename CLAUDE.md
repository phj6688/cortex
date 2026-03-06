# Cortex V3

AI task delegation control plane. Fastify 5 + tRPC v11 + SQLite backend, Next.js 16 + Tailwind 4 frontend.

## Commands
- Dev: `pnpm dev` (server 3481, web 9301)
- Build: `pnpm --filter server build && pnpm --filter web build`
- Test: `pnpm test` (vitest, 121+ tests)
- Typecheck: `pnpm typecheck`
- Docker: `docker compose up -d --build`

## Code Style
- TypeScript strict. No `any`. No `ts-ignore`.
- Files under 300 lines. Split aggressively.
- Prepared statements for ALL SQL. Never string concatenation.
- nanoid prefixes: tsk_, prj_, evt_, cmt_, ses_, aud_
- All dates as unix timestamps (seconds).
- IMPORTANT: Run `pnpm typecheck` after every change.

## Architecture
- server/src/ — Fastify 5 + better-sqlite3 + tRPC v11
- web/ — Next.js 16 App Router + Zustand + TanStack Query
- SSE via reply.hijack() (non-async handler). Zero polling.
- State transitions MUST go through task-machine.ts.
- Every DB mutation writes to events table (audit log).

## Gotchas
- YOU MUST NOT use exec(). Always execFile() with args array.
- SSE/NDJSON routes use reply.hijack() which bypasses CORS plugin — add CORS headers manually.
- Framer Motion: EXACTLY 4 uses (task-card, task-detail, state-badge, ao-dashboard). CSS transitions elsewhere.
- Docker: rebuild with `docker compose up -d --build` after server/src changes.
- AO project IDs: strip `prj_` prefix and replace `_` with `-` before sending to AO.
