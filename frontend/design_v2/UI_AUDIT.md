# Complete Current-Frontend Audit

All entries are **accepted current defects**, not optional suggestions. Evidence was read from current React runtime source, routes, CSS, tests, backend contracts, supplied screenshots, and the authoritative refocus brief. Counts: **7 Critical, 15 High, 14 Medium, 5 Low (41 total)**.

| ID | Evidence / affected routes | Severity | Approved correction / phase | Measurable acceptance |
| --- | --- | --- | --- | --- |
| C1 | `Sidebar.tsx`, `globals.css`; all workspaces; screenshot current compact nav | Critical | Fixed 272/84 shell and 768 drawer in 14C | labels never clip; 1024 rail tooltips; persisted state. |
| C2 | `Topbar.tsx`; all routes | Critical | utility group in 14C | Light/Dark, EN/AR, identity/menu present; no notification fiction. |
| C3 | `AdminManagementPages.tsx`, `/admin/users`, `/admin/doctors` | Critical | separate Team and Users & Access; 14C.0/14D | independent nav/list/detail; no account table presented as Team. |
| C4 | accounts models/serializers/views | Critical | professional-profile linkage API 14C.0 | profile list/detail/edit only expose verified fields; transition tests pass. |
| C5 | `globals.css` compact nav CSS; 1024 | Critical | replace text-indent/`data-compact-label` with Lucide rail 14C | no letter substitutes/clipped items. |
| C6 | dialog components across appointments/patients/billing | Critical | shared overlay manager 14C | focus trap/return, Escape/outside rules, dirty confirmation. |
| C7 | `AdminManagementPages.tsx`, invoice user forms | Critical | controlled selectors/detail-first actions 14C–14E | no raw Patient ID; role/duration/employee controlled. |
| H1 | `tokens.css`, `globals.css`, all screenshots | High | stronger token system 14C | approved light/dark palettes, contrast and semantic text/icon. |
| H2 | `Sidebar.tsx`, components | High | Lucide map 14C | every nav/core interaction mapped; icon-only accessible. |
| H3 | all dashboard pages | High | queue-first dashboards 14D | 3–5 KPIs, quick access, 4–6 previews and expansion. |
| H4 | dashboard descriptions mention backend/placeholder | High | user-facing copy 14D | zero technical/deferred phrases in UI. |
| H5 | `Card.tsx`, generic CSS, staff screenshot | High | composed card spec 14C | no large blank cards; header/body/actions and density meet spec. |
| H6 | `PatientTable.tsx`, `/patients` | High | rich patient row 14D | all required identity/contact/visit/status fields + row click. |
| H7 | tables/lists in billing/X-ray/audit/appointments | High | table/list shell 14C/14E | toolbar/header/separation/hover/focus/pagination. |
| H8 | visible View/row actions | High | action minimization 14C–14E | rows open detail; mutations in detail; no routine View. |
| H9 | `AdminClinicSettingsPage` | High | grouped setting cards 14E | 4 sections, controlled fields, responsive/sticky save. |
| H10 | `ScheduleManagementPage` prompts/flat lists | High | weekly master-detail 14E | date/time controls, impact confirmation, 768 no overflow. |
| H11 | appointment day/week/month components | High | real calendar hierarchy 14D | timeline/grid/list/reschedule each meets target behavior. |
| H12 | `PatientForm`, invoice create | High | grouped responsive forms 14D/E | 2/1-column fields/errors/dirty contract. |
| H13 | X-ray/external pages | High | protected-media composition 14E | image/AI panel/disclaimer/error/role controls. |
| H14 | `BillingPages.tsx`, print data | High | billing detail/A4 print 14E | selectors, detail actions, print without chrome. |
| H15 | current token CSS lacks full dark/RTL | High | persistent theme/i18n 14C/14F | all states mirrored/translated at four widths. |
| M1 | duplicate one-off global CSS | Medium | shared primitives 14C | component classes/tokens replace route-specific duplication. |
| M2 | fixed min-width tables | Medium | responsive table transforms 14C/14F | contained scroll/card-row, no page overflow. |
| M3 | `LoadingState`, `EmptyState`, `ErrorState` | Medium | structured states 14C | skeleton geometry and authorized next action. |
| M4 | forms use native/plain fields | Medium | focus/help/error controls 14C | 44px control, visible focus, described error. |
| M5 | appointment/billing/patient dialogs | Medium | dirty submit semantics 14C | unsafe closure impossible. |
| M6 | profile and own schedule/leave | Medium | profile hierarchy 14D/E | no sparse cards; linked account/team distinction. |
| M7 | audit logs detail | Medium | safe key/value drawer 14E | no raw JSON main view, paging/filtering. |
| M8 | active visit | Medium | patient-context workspace 14E | notes/save/complete hierarchy and ownership states. |
| M9 | inaccessible active affordances | Medium | keyboard semantics 14C | full row Enter/Space and contrast checks. |
| M10 | filter/action copy/placement inconsistent | Medium | standard toolbar 14C | one action priority per page and grouped filters. |
| M11 | dashboard queues unbounded | Medium | preview rule 14D | count/Show more/Collapse/View all. |
| M12 | low information density in settings/team/profile | Medium | grid/section layout 14D/E | data-rich sections, no wasteful full-width single field. |
| M13 | page headers duplicate workspace eyebrows | Medium | hierarchy/copy 14C | breadcrumb/title/purpose order with no redundant labels. |
| M14 | no global accessible tooltip contract | Medium | shared tooltip 14C | icon rail/actions labelled and focus-visible. |
| L1 | excessive uppercase status/header feel | Low | typography cleanup 14C | labels/caps limited to short metadata. |
| L2 | weak adjacent-list spacing | Low | 24 px list shell separation 14C | independent queues never visually touch. |
| L3 | logout prominence | Low | move to profile/bottom utility 14C | no dominant top-right Logout. |
| L4 | empty technical fallback copy | Low | literal user copy 14C | no endpoint/backend/deferred terminology. |
| L5 | responsive breakpoint inconsistency | Low | v2 breakpoint table 14F | QA evidence for 1440/1280/1024/768. |

All items enter Phase 14C+ as stated; none are implemented in Phase 14B.
