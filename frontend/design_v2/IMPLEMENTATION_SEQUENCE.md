# HISTORICAL / SUPERSEDED — NOT CURRENT IMPLEMENTATION AUTHORITY

Replacement: [`../CURRENT_PRODUCT_UI_SOURCE_OF_TRUTH.md`](../CURRENT_PRODUCT_UI_SOURCE_OF_TRUTH.md) and [`../../backend/project_docs/PROJECT_STATUS.md`](../../backend/project_docs/PROJECT_STATUS.md). Authority register: [`../../backend/project_docs/DOCUMENT_AUTHORITY_REGISTER.md`](../../backend/project_docs/DOCUMENT_AUTHORITY_REGISTER.md). This frozen Phase 14B sequence remains useful implementation history only.

# Frozen Implementation Sequence

1. **14C.0 — Doctor/Staff professional profile API and account linkage:** mandatory because current serializers/endpoints cannot deliver or edit a complete Team directory. Implement only the dependency work defined in `TEAM_USERS_ACCESS_SPEC_V2.md`, with migration and regression coverage.
2. **14C — Shell, tokens, Lucide icons, shared components:** install Lucide React, implement token/theme/i18n foundation, fixed/retractable shell, standard overlays, forms, tables, states.
3. **14D — Dashboards, appointments, patients, Team, Users & Access:** apply priority operational screens and validated API linkage.
4. **14E — Visits, X-rays/AI, billing, settings, audit, supporting screens:** retain RBAC/protected-media/print rules.
5. **14F — Responsive, dark, Arabic/RTL, visual regression, live UAT:** execute acceptance matrix with Phase 14A seed story.
6. **14G — Controlled deployment:** only after accepted visual/UAT evidence.

Phase 14B changes none of these runtime layers.
