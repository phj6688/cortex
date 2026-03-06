---
name: add-feature
description: Add a new feature to Cortex V3. Follows project conventions, adds tests, updates types.
---

# Add Feature Workflow

1. Read the task brief for feature description and acceptance criteria
2. Plan: which files to create/modify? Write the plan as comments first.
3. Implement server changes first (routes, queries, services)
4. Implement frontend changes (components, hooks, stores)
5. Add tests for new server logic
6. Run pnpm typecheck — MUST be zero errors
7. Run pnpm test — MUST be zero failures
8. Run pnpm --filter web build — MUST succeed
9. Commit with: git add -A && git commit -m "feat: [brief description]"
