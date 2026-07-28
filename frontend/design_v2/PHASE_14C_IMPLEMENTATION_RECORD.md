# Phase 14C Implementation Record

Phase 14C is complete. Backend runtime changed: no. Migrations: none.

## Implementation paths

- Tokens: `src/styles/v2/`.
- Shell and navigation: `src/layouts/WorkspaceLayout.tsx`, `Sidebar.tsx`, `Topbar.tsx`, `Shell.css`, `navigation.tsx`, and `i18n.ts`.
- Preferences: `src/auth/authStore.ts` using the existing `/api/me/preferences/` contract.
- Primitives and overlay foundation: `src/components/v2.tsx`.
- Compatibility adapters: `Card`, `PageHeader`, `StatusPill`, `LoadingState`, `EmptyState`, and `ErrorState`; Phase 14F owns their removal after 14D–14E consumer migrations.

## Verification

Six focused Phase 14C test files add 23 behavioral tests. Full frontend regression is 75 passed; typecheck, build, Django check, migration drift, documentation consistency, and diff checks pass. Production-shell coverage now includes per-user compact-rail persistence, drawer controls, LIGHT/DARK/SYSTEM resolution, live media-query handling, and EN/AR root direction.

The shared Modal/Drawer/ConfirmDialog foundation is complete and tested for outside click, Escape, focus, dirty discard, and pending locks. Phase 14D completed the appointment, patient, Team, and Admin account consumer migrations. Remaining Phase 14E migrations are billing dialogs (`features/billing/components/BillingDialogs.tsx`, `pages/billing/BillingPages.tsx`), visit dialogs (`features/visits/components/CompleteVisitDialog.tsx`), and X-ray dialogs (`features/xrays/components/*Dialog*.tsx`).

At the Phase 14C checkpoint, the Team route had not yet been introduced. Browser QA remains pending. Subsequent Phase 14D work added the runtime Team surface.
