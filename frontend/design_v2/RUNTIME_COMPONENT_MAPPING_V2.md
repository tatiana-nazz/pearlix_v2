# Runtime Component Mapping v2

No v2 primitive may coexist indefinitely with one-off CSS. Each old component is removed/deprecated when every listed consumer uses its replacement and the named test/evidence passes.

| Current group | Decision / defect | Target and phase | Order, risk, test, delete condition |
| --- | --- | --- | --- |
| `WorkspaceLayout` | Refactor; body/shell scrolling is not fixed/independent | `AppShell` 14C | Tokens→shell; medium layout risk; viewport/RTL tests; remove old wrapper after all role layouts migrate. |
| `Sidebar` | Replace; letter compact labels/clipping, no groups/icons | `SidebarNav`, `NavGroup`, drawer 14C | shell first; high navigation risk; route/RBAC/keyboard tests; delete old CSS label hack after 768 evidence. |
| `Topbar` | Replace; sparse utilities/logout prominence | `WorkspaceHeader`, theme/language/profile menu 14C | after shell; medium auth risk; preference/menu tests; remove old topbar after all roles use utilities. |
| PageHeader/SectionHeader | Refactor; noisy eyebrow/action hierarchy | `PageHeaderV2`, `SectionHeading` 14C | after tokens; low; visual/accessible action tests; deprecate old props after routes migrate. |
| `Card`, `StatCard` | Replace; equal blank surfaces | `SurfaceCard`, `KpiCard` 14C | primitives before pages; medium snapshot risk; density/theme tests; no old `.card` consumers remain. |
| tables/SummaryList | Split; floating lists/preview ambiguity | `DataTableShell`, `PreviewList`, `Pagination` 14C | before 14D; high behavior risk; paging/row click tests; delete `SummaryList` styles after dashboard migration. |
| `PatientTable`/filters | Refactor | `PatientRow`, `PatientListShell` 14D | after list shell; medium RBAC risk; role/pagination/tablet tests; remove old table markup after three role lists pass. |
| `StatusPill` | Refactor; color-only weak semantics | `StatusBadge` 14C | token primitive; low; semantic/contrast tests; old pill removed after all enums map. |
| forms/native selects | Replace | `Field`, `Select/Combobox`, `FormSection`, sticky bar 14C | before feature forms; high payload risk; validation/payload/keyboard tests; no raw-ID/select CSS left. |
| dialog backdrops | Replace | `Modal`, `Drawer`, `ConfirmDialog` 14C | overlay primitive; high focus risk; Escape/outside/dirty/focus-return tests; delete all local backdrop panels after migration. |
| Loading/Empty/Error | Refactor | `StatePanel`, `Skeleton` 14C | parallel primitives; low; state snapshots; deprecate old states after pages convert. |
| dashboard pages | Refactored | shared `features/dashboard` role compositions 14D.2 | uses `DashboardHeader`, metrics, lists, state panels, and links over the three existing role endpoints; focused role/RBAC/state/EN-AR tests; legacy page implementations replaced by compatibility re-exports. |
| appointment components | Refactored | v2 appointments workspace, date navigation, calendar/list, detail, reschedule components, and active-patient combobox 14D.3/14D.3A | uses server filters/availability, bounded active-patient search, and role-aware actions; no raw patient identifier input; base/queue navigation exact matching; retain existing route compatibility while patients remain Phase 14D work. |
| patient components | Refactor | profile header/tabs/row/form 14D | after patient shell; high versioning risk; edit/archive/conflict tests; remove old profile grids on acceptance. |
| patient workspace | Contract-complete | localized directory/profile/overview/medical copy, General Information creation, read-first profile, explicit medical-history form, accessible tabs 14D.4A | retains backend pagination, canonical Doctor access to every active/non-archived patient, versioning, archive actions, and bounded related summaries; browser verification remains pending. |
| visit pages | Refactor | clinical workspace/read-only detail 14E | after form/overlay; high ownership risk; save/complete/read-only tests; remove old workspace CSS after tests. |
| X-ray/AI pages | Refactor | imaging list/viewer/AI panel/external-case action sheet 14E | after media primitive; high protected-media risk; blob/revoke/RBAC tests; delete old xray grids after visual/regression evidence. |
| billing pages | Refactor | handoff/invoice/payment/print surfaces 14E | after list/form; high money/RBAC risk; amount/paging/print tests; remove old billing tables after evidence. |
| Admin management/Team | Split/replace | UsersAccess surfaces 14D; Team surfaces 14C.0/14D | API first; critical integrity risk; API transition/RBAC tests; do not retain generic user page as Team. |
| clinic settings | Refactor | settings sections/summary/sticky save 14E | after controls; medium payload risk; settings choice/save tests; remove oversized form CSS. |
| audit pages | Refactor | audit filter table/safe detail drawer 14E | after list/drawer; medium privacy risk; masking/paging tests; delete raw detail renderer after pass. |
| `globals.css`, `tokens.css` | Replace/split | v2 token layers and component modules 14C/14F | establish linted ownership; high cascade risk; visual regression at four widths/themes/RTL; delete legacy selectors once no import/usage remains. |

14F removes compatibility selectors only after the visual acceptance matrix passes; no feature may add new old-style one-off CSS after 14C starts.

## Phase 14C implementation note

`AppShell` is implemented by `src/layouts/WorkspaceLayout.tsx`; `SidebarNav` is implemented by `src/layouts/Sidebar.tsx`; and `WorkspaceHeader` is implemented by `src/layouts/Topbar.tsx`. The legacy `Card`, `PageHeader`, `StatusPill`, and state components are Phase 14C compatibility adapters over `src/components/v2.tsx`; Phase 14F owns their removal after feature consumers complete their 14D–14E migrations.

## Phase 14D.2 dashboard implementation note

`features/dashboard/DashboardShared.tsx` owns the common header, clinic-local date formatting, query states, KPI shell, preview list, and shortcut navigation. `AdminDashboard`, `StaffDashboard`, and `DoctorDashboard` compose only their permitted data and actions. The legacy route modules remain as re-exports so router contracts stay stable; the former generic dashboard compositions are removed.

## Remaining feature-specific overlays

The shared v2 overlay foundation is complete in 14C. Legacy feature consumers remain only to avoid feature redesign: `features/appointments/components/AppointmentConfirmDialog.tsx` and `AppointmentDetailsDialog.tsx` (14D, remove after appointment drawer/confirm migration); `features/patients/components/ArchivePatientDialog.tsx` and `pages/patients/PatientProfilePage.tsx` (14D, remove after patient detail/form migration); `pages/admin/AdminManagementPages.tsx` (14D, remove after Users & Access migration); `features/billing/components/BillingDialogs.tsx` and `pages/billing/BillingPages.tsx` (14E, remove after billing workflow migration); `features/visits/components/CompleteVisitDialog.tsx` (14E, remove after visit workspace migration); and `features/xrays/components/XrayUploadDialog.tsx` plus `ExternalXrayDialogs.tsx` (14E, remove after imaging workflow migration).
