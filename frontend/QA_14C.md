# Phase 14C QA — Shell, Tokens, Icons, and Shared Components

## Automated verification

- Frontend typecheck: passed.
- Frontend regression: **52 passed** in 24 files.
- Frontend production build: passed.
- Django check: passed. Migration drift: none (`makemigrations --check --dry-run`).
- Documentation consistency checker: passed. `git diff --check`: passed.

## Browser QA status

Browser QA is pending: the desktop browser session and Phase 14A demo accounts were not available in this implementation environment. Before visual acceptance, check Admin at 1440 expanded, Staff at 1024 rail, Doctor at 768 drawer, LIGHT/DARK, EN/AR, preference persistence, and feature-page overflow. This is an honest pending visual acceptance item for Phase 14F; no browser result is claimed.

## Exact foundation checks

- Shell is fixed/retractable at 272 px expanded, 84 px compact, and 72 px desktop header.
- Navigation has no `/admin/team` item or runtime route.
- Theme preference uses `/api/me/preferences/` with optimistic update and restoration on failure.
- Language preference sets `lang` and `dir`; shell copy is translated, while feature copy remains scheduled for 14D–14E.
