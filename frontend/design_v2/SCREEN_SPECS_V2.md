# Screen Specifications v2

Each route below uses the global component/table/form/overlay/responsive contract. Current defects are sparse generic cards, stale technical copy, weak action hierarchy, and inconsistent tablet/theme/RTL behavior; implementation acceptance is: the named hierarchy/action/permissions/state are present at 1440/1280/1024/768 in light/dark EN/AR, with loading/empty/error/read-only handling and no unauthorized action.

| Routes | Purpose, hierarchy, actions, and state acceptance |
| --- | --- |
| `/login`, `/change-password` | Branded compact authentication surface; Light/Dark + EN/AR before login; labelled fields, password visibility/requirements, error focus; 520 px max or balanced split panel; no marketing clutter. |
| `/admin/dashboard`, `/staff/dashboard`, `/doctor/dashboard` | Use `DASHBOARD_SPEC_V2`; role queue links, 3–5 KPIs, 4–6 previews/Show more/Collapse; no technical/placeholder wording. |
| `/admin/team`, `/admin/team/:memberId` (14C.0 dependency) | Use Team contract; do not render unsupported professional fields; profile actions only after API work. |
| `/admin/users`, `/admin/users/new`, `/admin/users/:userId` | Users & Access list/detail; one New user action; account controls in detail; raw account fields only; dirty role transition confirmation. |
| `/admin/doctors`, `/admin/leave`, `/admin/leave/:exceptionId`, `/staff|doctor/profile/schedule`, `/staff|doctor/profile/leave` | Schedule/default shifts/copy/apply in weekly master-detail; leave filter/calendar-list and impact count; edits Admin only; own views read-only; time/date selectors and confirmation for appointment-impact shift changes. |
| `*/appointments/day|week|month|list|needs-reschedule`, `/staff/appointments/:appointmentId/reschedule` | Header plus date prev/next/today, doctor/status filters, view tabs. Day timeline, week controlled grid, month count summary, list paginated table, reschedule split queue/detail; staff mutations only within detail/flow; Admin readonly, Doctor own and start-visit rules. |
| `*/patients`, `/staff/patients/new`, `*/patients/:patientId`, `/doctor/patients/:patientId/clinical-history` | Rich patient row/table, searchable filters and backend pagination; Staff Add patient only; detail header/tabs/role-aware billing; two-column grouped create/edit, controlled gender/blood group, dirty close. |
| `/doctor/visits/active`, `*/visits/:visitId` | Patient context remains visible; structured five clinical-note fields, dirty/save state, separate complete confirmation, X-ray secondary; Admin/Staff readonly; Doctor ownership enforced. |
| `*/xrays`, `*/xrays/:xrayId`, `/admin|doctor/external-xrays`, `/admin|doctor/external-xrays/:caseId` | Thumbnail/metadata/AI status list with pagination; protected viewer plus AI/disclaimer and safe media error; upload/run/attach/discard strictly per backend; no hard delete or public URL. |
| `*/billing/handoffs`, `*/billing/handoffs/:handoffId`, `/admin|staff/billing/invoices*` | Handoff queue/detail, invoice list/detail/payment/print. Staff has creation/mutation inside detail; Admin readonly; Doctor own handoffs readonly. New invoice uses patient/visit/appointment selectors, not IDs; print is A4 with no app chrome. |
| `/admin/clinic-settings` | identity, scheduling, language/currency/appearance, AI sections; summary above, controlled inputs, sticky save bar; supports Admin only. |
| `/admin/audit-logs`, `/admin/audit-logs/:auditLogId` | filterable paginated audit table; row opens safe key/value detail drawer/page; no raw JSON dominant view and no mutation. |
| `/access-denied`, `*` | concise state, return to authorized dashboard; no route/runtime leakage. |

`*` means role-prefixed implementation routes currently listed in `router.tsx`; their existing path and RBAC remain unchanged in 14B. All detail screens use top Edit when authorized; no permanent routine View button.
