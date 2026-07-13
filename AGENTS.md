# Repository Working Instructions

These instructions apply to all future work in this repository.

1. Before editing, inspect the complete relevant workflow: implementation, tests, contracts, styles, and documentation. Repository code and tests are the source of truth; do not rely on prior reports.
2. Checkpoint commits protect progress only. They do not end a task unless the task explicitly says they do. Do not finish while mandatory in-scope requirements remain incomplete.
3. Do not use `@ts-nocheck`, `@ts-ignore`, unsafe casts, or disabled/skipped tests to make checks pass. Fix the underlying type, runtime, or test issue.
4. Use the existing localization architecture. Never claim localization is complete while known static user-facing copy remains hardcoded.
5. Preserve backend contracts, serializers, permissions, models, migrations, RBAC, and object-level permissions unless a task explicitly authorizes a change.
6. Test real production components and pages with meaningful behavior coverage; do not rely on snapshots alone.
7. Before handoff, run the relevant typecheck, full tests, build, Django check, migration-drift check, documentation-consistency check, and diff check.
8. Never mark a phase complete unless runtime behavior, tests, and canonical documentation agree. Do not fabricate browser QA.
9. Leave a clean, committed working tree. Attempt one push; if policy blocks it, preserve the clean commit for the UI push button. Never ask for or use a personal access token.
