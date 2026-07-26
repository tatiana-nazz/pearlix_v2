# Phase 14F Full Frontend Visual Source Migration Record

This is an implementation and acceptance record, not product/role authority.

## Scope and source inspection

Phase 14F adopts the supplied Pearlix reference pack across the current frontend while preserving the current runtime application. The manifest, `src.zip`, all six screenshots, global theme/layout sources, shared primitives, overlays, appointment/profile/Team/schedule examples, and responsive behavior were inspected. The extraction and browser evidence stayed outside Git.

Functional authority was read before implementation: `CODEX_START_HERE.md`, canonical project status and authority register, current backend decisions, the current product/UI source of truth, runtime routes, API wrappers, RBAC utilities, and affected tests.

## Token mapping

| Reference role | Runtime token |
| --- | --- |
| Canvas `#f6f8fc` | `--v2-canvas`, `--color-bg` |
| Surface `#ffffff` | `--v2-surface`, `--color-surface` |
| Soft surface `#f9fafd` | `--v2-surface-subtle` |
| Border `#e5eaf3` | `--v2-border` |
| Divider `#eef1f6` | `--v2-divider` |
| Primary `#3f63f2` | `--v2-primary` |
| Primary hover `#2f51d9` | `--v2-primary-strong` |
| Primary soft `#eef3ff` | `--v2-primary-soft` |
| Secondary `#5baef7` | `--v2-secondary` |
| Teal `#14b8a6` | `--v2-teal` |
| Text `#1e293b` | `--v2-text` |
| Secondary text `#64748b` | `--v2-muted` |
| Muted text `#94a3b8` | `--v2-text-muted` |
| Card/dialog/control radius | `--v2-radius-card`, `--v2-radius-dialog`, `--v2-radius-control` |
| Card/modal shadow | `--v2-shadow-major`, `--v2-shadow-modal` |

Legacy semantic variables now map to the same v2 tokens rather than maintaining an independent color system. Dark mode uses the same semantic roles with contrast-safe dark values.

## Shell and shared components

- Rebuilt the workspace shell around the 264px/76px sidebar, 68px topbar, gradient brand tile, active navigation indicator, grouped navigation, and separated Logout control.
- Preserved persisted collapse, mobile drawer, Escape/focus return, RTL logical positioning, and the frozen 1279/1023/767 transformations.
- Re-skinned shared buttons, icon buttons, cards, status badges, tables, filters, forms, tabs, state panels, sticky actions, comboboxes, dialogs, drawers, and responsive overlays.
- Added a brand favicon so browser QA has no missing-resource console noise.
- Kept current component logic and API hooks; the work consolidates presentation instead of cloning reference components.

## Route audit and migration

Every current route family was audited and migrated through the shared shell/primitives plus targeted composition:

- Authentication: login, change password, access denied, and not found.
- Admin: dashboard; profile; Team list/new/detail; Users & Access list/new/detail; schedules; leave; clinic settings; audit logs; all appointment views; patients/detail; visit detail; saved/external X-rays and details; billing handoffs/details; invoices/details/print.
- Staff: dashboard; profile/schedule/leave; all appointment views/create/reschedule; patient list/new/detail; visit detail; saved X-rays/detail; handoffs/detail; invoices/new/detail/payment/print.
- Doctor: dashboard; profile/schedule/leave; own appointment views; patient list/detail/clinical history; active/detail visit; saved/external X-rays and details; own handoffs/detail.

No current route family remains on the previous visual system.

Targeted high-fidelity recomposition was applied to Staff/Doctor appointments, own Staff/Doctor profiles, patient profile, Team/Users & Access surfaces, dashboards, Active Visit, Billing, X-ray/AI, authentication, and settings. Team and Users & Access remain separate current workflows.

## Functional and RBAC preservation

No prototype state, fixture, session context, fake endpoint, or mock clinical result was copied. Existing TanStack Query hooks and typed API clients remain in place. Collection rows remain action-free; detail-only mutations and the primary/secondary/danger hierarchy remain intact.

Admin, Staff, and Doctor route guards and backend authorization remain unchanged. Doctor has no global Billing entry or invoice/payment action. Admin has no Staff-only financial or patient mutation. Staff retains only current supported mutations.

The protected-media acceptance exposed that backend detail payloads return `/api/...` media paths while the configured API base already ends in `/api`. The frontend Blob client now normalizes that returned path before the authenticated request, preserving private media and eliminating the accidental `/api/api/...` request. A cross-realm Blob fallback keeps bytes in memory for embedded Chromium without creating a public URL.

## Responsive, localization, dark mode, and accessibility

- Breakpoints remain 1279px, 1023px, and 767px.
- Desktop expanded/compact shell, tablet drawer shell, and mobile stacking/scrolling were browser-tested with no document-level horizontal overflow.
- English and Arabic preference updates, RTL direction, and logical sidebar/drawer transforms were browser-tested.
- LIGHT/DARK/SYSTEM behavior remains server-persisted; light and dark visual captures passed.
- Semantic headings, landmarks, accessible names, status text, keyboard-openable rows, focus-visible outlines, touch-sized controls, and reduced-motion behavior remain in the shared contract.

## Verification

- Frontend unit/component tests: 136 passed in 47 files.
- Phase 14F Chromium visual acceptance: 4 passed.
- Complete Chromium browser suite: 7 passed.
- TypeScript typecheck: passed.
- Production build: passed.
- Backend complete suite: 420 passed.
- Django system check: no issues.
- Migration drift: no changes detected.
- Browser console errors: 0 in Phase 14F acceptance.
- Browser request failures: 0 in Phase 14F acceptance.
- Browser HTTP responses at or above 400: 0 in Phase 14F acceptance.
- Protected original image: authenticated request returned `200 image/png`; rendered image had non-zero natural width; stored AI result and confidence rendered.

## Evidence

Generated before/reference and after screenshots, including desktop role dashboards, appointments, Staff profile, Team/member, Users & Access, patient profile, working-hours editor, Active Visit, invoice/payment detail, X-ray/AI, tablet, mobile, RTL, and dark mode, are stored outside Git at:

`C:\Users\i\.codex\visualizations\2026\07\26\019f9bcf-f389-7413-84b4-06599ee8e6fb\phase14f_browser_evidence`

The supplied reference screenshots remain the visual-before/target evidence. No screenshot, trace, build output, environment file, or credential is committed.
