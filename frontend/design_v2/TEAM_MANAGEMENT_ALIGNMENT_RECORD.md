# Stage 5 — Team and staff-management alignment

Stage 5 aligns Team, Users & Access, schedules, leave, and own-profile surfaces to the medical-blue composition. Source baseline: `post-14f-medical-blue-patients` / `03f012d7b489a8adb61c80da0f6a830d8f24059a`.

The implementation adds page-level command headers, a contained Team filter rail, operational card zones, an account-security register, differentiated schedule workspaces, leave scanning rails, and profile identity/detail hierarchy. It preserves backend behavior, RBAC, routes, query parameters, optimistic versions, Team search/pagination, schedule impact confirmation, leave cancellation, password/reset flows, role-transition tokens, Staff read-only Team access, and Doctor self-service-only access.

Accessibility is preserved through existing tab, button, table, status, focus, and long-value semantics. The layout uses logical properties and responsive rules for compact/RTL views. Dark schedule/leave and Arabic/RTL Doctor profile evidence are included.

- Backend changes: none.
- Migrations: none.
- Focused checks: Team, Users & Access, schedule/leave, and own-profile tests.
- Evidence: `frontend/design_v2/design_alignment_evidence/team-management/`.
- Visual delta: `frontend/design_v2/TEAM_MANAGEMENT_VISUAL_DELTA.md`.
- Implementation commit: `9177f5ea46f9779de762c7776b6b443c293d77bd`.
- Next recommended stage: billing and financial workflow alignment.
