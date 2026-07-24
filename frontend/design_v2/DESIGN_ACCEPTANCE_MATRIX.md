# Route-Level Design Acceptance Matrix

## Phase 14C foundation result

Phase 14C delivers the v2 shell, token layer, Lucide map, EN/AR direction foundation, and shared-component adapters. Browser visual acceptance remains pending and is explicitly recorded in `frontend/QA_14C.md`; feature compositions remain Phase 14D–14E and final visual acceptance is Phase 14F.

Automated Phase 14C shell verification includes persisted collapse, top control/footer logout, drawer close behavior, theme toggle/SYSTEM media-query behavior, and EN/AR root direction. Browser evidence remains pending.

Pass means seeded populated, loading, empty, error, permission/read-only/locked as applicable all meet the exact expectation; route opening alone fails. Browser evidence is a named screenshot/video at 1440/1280/1024/768 in light/dark and EN/AR where relevant. Automated expectation means add/update test in the implementation phase.

| ID | Route/component and seeded scenario | Exact expectation / automated expectation | Browser evidence / pass criterion | Phase |
| --- | --- | --- | --- | --- |
| SH-01 | shell expanded, Admin seed | 272 px fixed sidebar, 72 px header, independent content scroll | 1440 light/EN; no overlap/clipping | 14C |
| SH-02 | shell collapsed, Staff seed | 84 px Lucide rail, tooltip/name, persisted state | 1024 dark/EN; no letter labels | 14C |
| SH-03 | tablet drawer, Doctor seed | labelled focus-trapped drawer, closes after navigation | 768 light/AR; no page overflow | 14C |
| SH-04 | header utilities | theme, EN/AR, profile/role menu update preferences | interaction test + both themes/languages | 14C |
| DB-ADM | `/admin/dashboard`, role dashboard data | four supervisory KPIs, attention/activity previews, management-only links; no operational mutation | automated role/link/state/Arabic coverage; browser 1440/1280/1024/768 populated + empty/error | 14D.2 |
| DB-STF | `/staff/dashboard`, role dashboard data | appointment, checked-in, reschedule, unpaid-invoice KPIs; operational links only | automated role/link/state/Arabic coverage; browser 1440/1280/1024/768 queue click and empty state | 14D.2 |
| DB-DOC | `/doctor/dashboard`, own active visit data | own-only appointment KPIs, active/next patient, no billing/check-in/create action | automated role/link/state/Arabic coverage; browser 1440/1280/1024/768, no billing action | 14D.2 |
| TEAM-L | `/admin/team`, Doctor/Staff seeds | tabs, search, paged rich rows, only supported fields | 1440/1024/768 + Team API/RBAC test | 14C.0/14D |
| TEAM-D | `/admin/team/:memberId` | ordered profile/schedule/leave/workload/account; no fake activity | supported-field/error/readonly evidence | 14C.0/14D |
| USER-L | `/admin/users` | account columns, profile-setup state, row detail | pagination/filter/RBAC test + tablet card | 14D |
| USER-N | `/admin/users/new` | account-only; Doctor/Staff profile-required notice | validation/must-change test | 14D |
| USER-D | `/admin/users/:id` | separate role/reset/deactivate confirmations | transition/deactivation test + evidence | 14C.0/14D |
| PAT-L | all role patient lists | rich row columns, role filters, server pagination | role/row keyboard/tablet tests | 14D |
| PAT-P | all role profiles | ordered header/tabs; billing only Admin/Staff | ownership/archive/billing tests | 14D |
| AP-D | appointment Day | exact toolbar/timeline/drawer and role actions | date/filter/action tests, 1440/768 | 14D |
| AP-W | appointment Week | readable 7-day contained grid | width/scroll/RTL evidence | 14D |
| AP-M | appointment Month | count summary then day navigation | calendar selection test/evidence | 14D |
| AP-L | appointment List | paged clickable rows/filter preservation | pagination/keyboard/tablet test | 14D |
| AP-R | Needs Reschedule/reschedule | queue + availability, one-record confirmation | availability/RBAC test/evidence | 14D |
| SCH-01 | `/admin/doctors` | default/employee 5/7 weekly master-detail | impact confirmation test + 1440/768 | 14E |
| LEAVE-01 | `/admin/leave*` | filter/list-calendar/detail/cancel no DELETE | cancel/version/RBAC test | 14E |
| VIS-A | `/doctor/visits/active` | five notes, dirty/save/complete separation | ownership/dirty test + 1440/768 | 14E |
| VIS-R | Admin/Staff visit | context/notes read-only boundary | permission test/evidence | 14E |
| XR-S | saved X-ray/AI | protected viewer, overlay/disclaimer/error | blob/RBAC test + dark viewer | 14E |
| XR-E | external X-ray | status list and attach/discard/run-AI boundaries | role/action confirmation test | 14E |
| BILL-H | handoff list/detail | role-specific conversion/dismiss/action placement | RBAC/status test + tablet | 14E |
| BILL-I | invoice/new/detail/payment/print | controlled patient selection, balances, A4 print | amount/payment/print test | 14E |
| SET-01 | clinic settings | four sections, controlled fields, sticky save | settings payload/error/tablet test | 14E |
| AUD-01 | audit list/detail | filters/paging/safe key-value/no mutation | masking/RBAC/tablet test | 14E |
| OVR-01 | all modals/drawers | safe outside/Escape, dirty/submitting lock/focus return | overlay keyboard test/video | 14C |
| FORM-01 | controlled forms | no raw IDs, help/error/focus/44 px controls | payload/accessibility tests | 14C |
| THEME-01 | all target routes | tokenized light/dark including hover/focus/status | visual regression matrix | 14F |
| RTL-01 | all target routes Arabic seed | Arabic type/bidi/logical mirroring | visual regression matrix | 14F |
| WIDTH-01 | all priority routes | 1440,1280,1024,768 geometry/no overflow | four screenshots each role | 14F |

Any failed ID blocks the dependent phase and Phase 14G.
