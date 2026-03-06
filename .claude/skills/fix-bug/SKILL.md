---
name: fix-bug
description: Fix a bug in the Cortex V3 codebase. Reads error context, locates root cause, implements fix, runs tests.
---

# Fix Bug Workflow

1. Read the task brief for bug description and acceptance criteria
2. Search codebase for relevant files: grep -rn "keyword" server/src/ web/
3. Identify root cause — check recent git changes: git log --oneline -10
4. Implement the fix
5. Run pnpm typecheck — MUST be zero errors
6. Run pnpm test — MUST be zero failures
7. Test manually if the brief specifies manual verification steps
8. Commit with: git add -A && git commit -m "fix: [brief description]"
