# Phase 14C Implementation Record

Phase 14C is complete. Backend runtime changed: no. Migrations: none.

## Implementation paths

- Tokens: `src/styles/v2/`.
- Shell and navigation: `src/layouts/WorkspaceLayout.tsx`, `Sidebar.tsx`, `Topbar.tsx`, `Shell.css`, `navigation.tsx`, and `i18n.ts`.
- Preferences: `src/auth/authStore.ts` using the existing `/api/me/preferences/` contract.
- Primitives and overlay foundation: `src/components/v2.tsx`.
- Compatibility adapters: `Card`, `PageHeader`, `StatusPill`, `LoadingState`, `EmptyState`, and `ErrorState`; Phase 14F owns their removal after 14D–14E consumer migrations.

## Verification

Four focused Phase 14C test files add 14 behavioral tests. Full frontend regression is 66 passed; typecheck, build, Django check, migration drift, documentation consistency, and diff checks pass.

The shared Modal/Drawer/ConfirmDialog foundation is complete and tested for outside click, Escape, focus, dirty discard, and pending locks. Named feature-consumer migrations remain: appointment dialogs (`features/appointments/components/*Dialog.tsx`, owner 14D); patient archive/edit dialogs (`features/patients/components/ArchivePatientDialog.tsx`, `pages/patients/PatientProfilePage.tsx`, owner 14D); billing dialogs (`features/billing/components/BillingDialogs.tsx`, `pages/billing/BillingPages.tsx`, owner 14E); visit dialogs (`features/visits/components/CompleteVisitDialog.tsx`, owner 14E); X-ray dialogs (`features/xrays/components/*Dialog*.tsx`, owner 14E); and Admin account dialogs (`pages/admin/AdminManagementPages.tsx`, owner 14D).

No `/admin/team` runtime route exists. Browser QA remains pending. Next phase: Phase 14D — Priority Workflows: Dashboards, Appointments, Patients, Team, and Users & Access.
