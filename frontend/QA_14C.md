# Phase 14C QA — Shell, Tokens, Icons, and Shared Components

## Runtime scope

Phase 14C delivers the v2 shell, tokens, Lucide map, authenticated preference persistence, EN/AR shell foundation, and reusable primitives. It does not add `/admin/team` or redesign dashboards, appointments, patients, visits, X-rays, billing, settings, audit, Team, or Users & Access.

## Focused automated coverage

- `src/layouts/foundation.test.tsx`: role-safe destinations, no Team route, active/compact navigation, accessible tooltips, and EN/AR shell dictionary.
- `src/auth/authStore.preferences.test.ts`: authenticated preference PATCH success and rollback without session corruption.
- `src/components/v2.test.tsx`: buttons, statuses, tabs, clickable rows, previews, table states, fields/selects/comboboxes, and modal close/dirty/focus/pending behavior.
- `src/styles/v2/tokens.contract.test.ts`: light/dark semantic tokens, 272/84/72 shell contract, and Lucide-only navigation source.
- `src/layouts/workspaceShell.behavior.test.tsx`: production collapse persistence, per-user isolation, top-only control, drawer open/Escape, logout, RTL shell direction, and no-Team contract.
- `src/layouts/topbar.behavior.test.tsx`: production LIGHT/DARK/SYSTEM controls, live media-query response, accessible system state, EN/AR root direction, and human-readable localized metadata.

Focused Phase 14C result: **23 passed**. Full frontend regression: **75 passed** in 30 files. Typecheck and production build: passed.

Collapse persistence and per-user isolation, tablet drawer close behavior, LIGHT/DARK/SYSTEM, EN/AR/RTL root state, directional icon class, bidi utility, and preference rollback are automated. Browser visual acceptance remains pending.

## Backend and repository verification

- Django check: passed.
- Migration drift: none (`makemigrations --check --dry-run`).
- Documentation consistency checker: passed.
- `git diff --check`: passed.
- Backend runtime changed: no. Migrations: none.

## Browser QA status

Browser QA is pending; no browser visual acceptance is claimed. The manual matrix is Admin at 1440 expanded; Staff at 1024 compact rail; Doctor at 768 drawer; LIGHT/DARK/SYSTEM; EN/AR and RTL; preference persistence; role navigation; and feature-page clipping/overflow. Final visual acceptance remains Phase 14F.
