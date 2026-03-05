# Cortex V3 — Agent Rules

## Architecture
- **Backend**: Fastify 5, tRPC v11, better-sqlite3, pino
- **Frontend**: Next.js 16, Tailwind CSS v4, Zustand, TanStack Query v5
- **Build**: tsup (server), next build (web), biome (lint)
- **Test**: vitest (server), playwright (e2e)

## Ground Rules
1. TypeScript strict mode. No `any`. No `ts-ignore`. No `as unknown as X`.
2. Every file < 300 lines. One concern per file.
3. All env vars validated at startup with zod (server/src/env.ts).
4. All API responses follow `{ success: boolean, data?: T, error?: string }`.
5. Zero polling. All real-time = SSE push only.
6. NEVER `exec()` for shell commands. Always `execFile()` with args array.
7. Every public function has JSDoc with @param and @returns.
8. Prefixed IDs: tsk_, prj_, evt_, cmt_ (server/src/lib/id.ts).
9. State transitions enforced by task-machine.ts — never bypass.
10. All DB queries use prepared statements — never build SQL dynamically.

## Port Map
- Server: 3481
- Web dev: 9301
- Old Cortex: 3480 (never touch)

## Protected
- /home/lumo/cortex (old Cortex)
- postgres, neo4j, redis containers
- /home/lumo/.env
