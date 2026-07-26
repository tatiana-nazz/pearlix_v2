# Phase 14F.1 UI Acceptance Correction Record

**Status:** delivered on 2026-07-26

**Starting authority:** `2f7070fca7fbf84d3c2578285416b5ae5f52453b` on `phase-14f-full-visual-source-migration`

## Why this correction exists

Phase 14F implemented the supplied visual source but did not pass direct user acceptance. Phase 14F.1 is the binding correction layer. It preserves backend APIs, models, migrations, RBAC, protected media, and completed workflows while correcting the visible product hierarchy and demo evidence.

## Delivered corrections

- Replaced the generic Lucide brand glyph with one reusable Pearlix SVG mark used by the sidebar, authentication shell, and favicon.
- Removed the top-right account/avatar menu and generic dashboard Refresh action. The topbar now contains identity text, theme, and the text-only `EN`/`AR` control.
- Added meaningful semantic dashboard tones and prominent Staff `New appointment` / `New patient` actions; Admin has `Add team member` / `Create user` actions.
- Reduced shell and page whitespace and simplified the sidebar collapse affordance to an arrow.
- Consolidated Staff and Doctor personal navigation into one `My Profile` route. Schedule and leave remain inside that profile. Admin has a sidebar `Profile` route.
- Repaired appointments into a `Calendar` / `Reschedule Queue` workspace with `Day`, `Week`, `Month`, and `List` calendar views for every permitted role. The queue is no longer a sidebar destination. Search and filters are compact and query state survives view transitions.
- Repaired Staff/Doctor patient Edit deep-link state, moved it to the focus-managed shared modal, retained loaded values, and preserved the versioned update payload. Admin remains read-only.
- Replaced the generic Clinic Settings field dump with typed cards for identity, scheduling, locale/currency, and AI operations plus one save area.
- Enhanced the DEBUG-only demo command with connected leave/shift reschedule transitions, a completed reschedule, richer synthetic imaging, returning-patient history, Staff leave, split shifts, inactive and must-change accounts, and deterministic clinic-local dates.

## Protected boundaries

No production backend behavior, API contract, database model, migration, authorization rule, billing rule, visit rule, or protected-media rule changed. Backend edits are limited to the DEBUG-only seed command, its tests, and documentation.

## Evidence

The focused/full automated and direct-browser evidence is recorded in [`../QA_14F1_UI_CORRECTION_RICH_DEMO_STORY.md`](../QA_14F1_UI_CORRECTION_RICH_DEMO_STORY.md). Browser screenshots are generated evidence outside the repository and are not product authority.
