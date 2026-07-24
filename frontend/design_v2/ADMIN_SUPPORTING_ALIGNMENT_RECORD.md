# Stage 9 — Admin and supporting alignment

Source branch: `post-14f-medical-blue-xrays-ai` at `7253ebd78cfd5ae23fd52c71c9dccda9eb6724f0` (`docs: finalize xray ai alignment evidence`). Stage branch: `post-14f-medical-blue-admin-supporting`. Implementation commit: `d5fe795fb291bdd50b22626b25caaf70f3f4d5e6`.

## Authority and inventory

Active authority was the backend settings/audit contracts, current router and tests, Phase 14F behavior, and the medical-blue token system. Historical documents under `frontend/design/`, old QA reports, and prior prompts were excluded. Completed Stage 1–8 surfaces were excluded: foundation/shared system, dashboards, appointments, patients, team/schedules/leave/profile, billing, visits, and X-rays/AI.

| Classification | Routes / reason |
| --- | --- |
| Active Stage 9 | `/admin/clinic-settings` — Admin settings command surface, GET/PATCH `/api/clinic/settings/`; `/admin/audit-logs` and `/admin/audit-logs/:auditLogId` — Admin read-only audit register/detail, GET `/api/audit-logs/` and `/api/audit-logs/:id/`; `/access-denied` and `*` not-found — active safe supporting states. |
| Completed exclusions | `/admin/profile`, `/staff/profile`, `/doctor/profile` (Stage 5); `/admin/users*`, Team, schedules and leave (Stage 5); all dashboard, appointment, patient, billing, visit, and X-ray routes (Stages 2–8). |
| Redirected | Role roots redirect to dashboards; `/admin/appointments`, billing collection aliases, profile schedule/leave aliases, and legacy external-X-ray routes retain their existing redirect targets. |
| Denied | Staff and Doctor direct Admin routes enter the existing RoleGuard and receive `/access-denied`; no protected route or object name is disclosed. |
| Dormant / shared only | No unactivated Admin/supporting route was found. `StatePanel` remains a shared state primitive; its existing page-specific loading/error/empty paths remain active. Login and forced password change are authentication-specific and intentionally excluded. |

Clinic Settings is Admin-write only; Staff/Doctor retain backend-safe read-only API access but no Admin route. The singleton preserves IANA timezone strings, supported duration/default relationships, validation, dirty navigation blocking, exact partial payloads, mutation pending/success/failure behavior, and cache invalidation. Audit remains Admin-only, immutable, newest-first, paginated at the server, URL-filtered, and redacts secret-like metadata keys. It has no create, edit, delete, export, or raw request-body UI.

## Implemented frontend alignment

- Clinic Settings now uses a command header and a two-column settings-register composition: each operational group has a persistent section identity rail, bounded control grid, grouped duration/currency controls, and a retained sticky save/discard bar. The responsive breakpoint changes this safely to a single-column form.
- Audit now has a clearly read-only command header, dedicated filter rail, bounded filter reflow, a count-bearing register, scan-oriented action/entity hierarchy, local table scrolling, and a read-only detail marker. Actor/action/target/timestamp/filter/pagination contracts are unchanged.
- Access-denied and not-found routes now use localized, heading-first supporting-state compositions with existing safe return destinations. No route, role, session, or privacy semantics changed.

The implementation uses logical properties, native labels, visible validation errors, `bdi` for dynamic identifiers, keyboard-operable rows, semantic tables, existing focus primitives, Lucide icons, existing theme persistence, and no document-level overflow. Dark and Arabic/RTL captures passed. Local horizontal scrolling remains limited to the table scroll container when needed.

## Verification and evidence

- Frontend baseline: 75 files / 258 tests passed.
- Focused Stage 9 checks: 3 files / 21 tests passed.
- Final frontend suite: 76 files / 260 tests passed. Typecheck and production build passed.
- Django check passed; migration dry-run reported no changes. Backend source changes: none. Migrations: none.
- Terminal Playwright ran isolated Microsoft Edge contexts against deterministic seed data. Settings data was not saved during browser QA; the demo story was reseeded before final after evidence.
- Evidence: `frontend/design_v2/design_alignment_evidence/admin-supporting/`; visual delta: `frontend/design_v2/ADMIN_SUPPORTING_VISUAL_DELTA.md` — PASS.

Functional classification: frontend visual composition, localization, and accessibility only. Deferred: synthetic unavailable/empty states without an active deterministic runtime trigger remain covered by production component tests; no artificial route or API failure was introduced.
