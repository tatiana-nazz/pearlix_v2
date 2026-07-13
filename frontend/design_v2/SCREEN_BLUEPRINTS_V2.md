# Route-Level Screen Blueprints v2

## Required state and adaptation rule

Every blueprint below has this non-optional state set: skeleton matching the named grid while loading; compact icon/title/explanation and only an authorized action when empty; inline retry/error when recoverable; explicit permission/read-only/locked reason where relevant; tokenized light/dark surfaces; translated EN/AR static copy; logical RTL alignment, mirrored directional icons, and bidi-isolated email/phone/ID/date/currency. Keyboard order follows the listed section order, rows are Enter/Space operable, controls have labels, focus rings, and 44 px targets. At 1440 use the listed desktop grid; 1280 reduces gaps but retains hierarchy; 1024 uses the listed compact/stack rule; 768 uses the listed tablet rule with no page overflow.

## Authentication

### `/login`
Purpose: authenticated entry. Order: brand/language-theme utilities, title, email, password with reveal, validation/error, Sign in, support text. Desktop is 520 px form beside a 7/5 muted clinical identity panel; 1280 remains split; 1024 collapses identity to upper banner; 768 single 16 px-padded card. No row navigation or mutation beyond submit; loading locks submit. Acceptance: incorrect credentials focus the error summary then retain values; must-change response routes only to password change.

### `/change-password`
Purpose: forced/voluntary credential change. Order: context, current password (when API requires), new password, requirements, confirm password, error, Save password, Logout. Same 7/5→single composition as login. Submit is destructive-to-session-sensitive and cannot close; success redirects to role dashboard. No other primary action.

## Dashboards

### `/admin/dashboard`
Purpose: supervisory operations. Above fold: title/date, `Clinic settings` secondary action, KPIs Active patients → Today appointments → Needs reschedule → Pending handoffs → Unpaid invoices, then 8/4 grid: Needs attention queue (left) and Recent audit/clinic summary (right). Queue rows show identity, date/status, reason, chevron; 4 initial items, Show more to 8, Collapse, View all to filtered destination. KPI links: patients active, appointments date=today, needs-reschedule status, handoffs pending, invoices unpaid. 1440 five KPI columns; 1280 3+2; 1024 two columns then 7/5 stack; 768 one-column. Admin has no workflow mutation cards.

### `/staff/dashboard`
Purpose: front-desk execution. Above fold: title/date, `New appointment`, `Find patient`, KPIs Today appointments → Checked in → Needs reschedule → Pending handoffs → Unpaid/partially paid. Queues in order: Upcoming today, Checked-in, Needs reschedule, Pending billing handoffs, Recent patients, Own schedule/leave summary. Rows show patient, time/doctor, status, context and chevron; each preview 4, expands to 8, collapses, View all routes to its filtered dataset. 1440 KPI 5-up and queues 6/6; 1280 3+2 and 7/5; 1024 two KPI columns/one queue column; 768 one. Click destinations preserve date/status; no fake navigation or unsupported payment action.

### `/doctor/dashboard`
Purpose: clinical day management. Above fold: active-visit banner (if present), `Resume active visit` or valid `Start visit`, KPIs Today appointments → Checked in → Active visit → Needs reschedule → Completed today. Queue order: Next patient/today schedule, checked-in, recent visits, own reschedules, own pending handoffs, own schedule/leave. Four preview rows expanding to 8; View all uses own route/filter. 1440 active banner full width then 5 KPI/7-5 queues; 1280 3+2; 1024 two KPIs and stacked panels; 768 active banner then one column. Billing invoices/payments and global clinic actions are prohibited.

## Team and Users & Access

### `/admin/team`
Purpose: operational directory after 14C.0. Order: title, `Add Team Member`, All/Doctors/Staff tabs, search/filter toolbar, paginated rich Team rows. Desktop row: 36 px avatar/name-role, specialty or position, professional contact, work/leave state, today workload, chevron; 1440 full table, 1280 hides secondary workload, 1024 contained table, 768 card row. Whole row opens detail; no View. API unavailable before 14C.0 renders a release-gated read-only explanation, not fabricated data.

### `/admin/team/:memberId`
Purpose: professional record. Order: back, profile summary, `Edit profile`, linked account, General Info, Working Hours/Shifts, Leave Exceptions, Today workload; tabs are only used when sections exceed visible context. Desktop 4/8 summary/content; 1024 stack; 768 one column. Schedule/leave are navigations; account role/deactivate goes to Users detail. Unsupported notes/activity/photo/license/gender are absent.

### `Add Team Member`, `Edit Doctor Profile`, `Edit Staff Profile`
Purpose: transactional professional onboarding/edit after 14C.0. Modal/drawer is 720 px max, section order Account access → Professional profile → initial status → confirm. Doctor has specialty/phone/bio only; Staff has position/phone only; all controlled where domain constrained. Submit creates/updates exactly one profile plus account, dirty close confirms discard, failure retains input. At 768 full-width dialog; no standalone generic user creation substitutes this flow.

### `/admin/users`
Purpose: access control. Order: title, `New user`, search/role/login/profile-state filters, paginated account table. Columns name/email, role, login status, must-change, timestamps, linked-profile state, chevron. 1440 all; 1280 hide updated timestamp; 1024 contained scroll; 768 account cards. Row opens account detail; no permanent View or hard-delete action.

### `/admin/users/new`
Purpose: account-only creation. Order: title/back, Account identity, Role, temporary password/help, Create user. Single 760 px form at desktop (two-column identity), single at 1024/768. Admin creation has no Team profile; Doctor/Staff account creation visibly states `Profile setup required` until 14C.0 flow is used.

### `/admin/users/:userId`, `Change Role`, `Reset Password`, `Deactivate Account`
Purpose: account detail/security actions. Order: back/summary, Account identity, Security, Role, linked Team profile, separated Danger zone. Change role requires transition preview/confirmation; reset password is a focused confirmation form; deactivate names history preservation and blocks accidental close. Desktop 7/5 detail/security; tablet stack. Reactivation is hidden until supported API exists.

## Patients

### `/admin/patients`, `/staff/patients`, `/doctor/patients`
Purpose: role-specific discovery. Order: title/action (Staff `Add patient` only), search, archive or Doctor workflow filters, count/table, pagination. Columns: Patient avatar/name + age/gender; Contact phone/email; Last visit; Next appointment; relevant archive/status; chevron. Admin is read-only, Staff archive/create/edit through detail, Doctor active-only contextual scopes. 1440 full columns; 1280 hide last visit; 1024 scroll; 768 patient cards. All rows open profile; paging never uses Show more.

### `/staff/patients/new`
Purpose: create. Order Identity → Contact → Medical summary → Insurance/emergency → Address → sticky Cancel/Create. 1200 px two-column form at 1440/1280, one column at 1024/768. Gender/blood group controlled; archive is not raw checkbox; duplicate/validation errors are local.

### `*/patients/:patientId`, `/doctor/patients/:patientId/clinical-history`
Purpose: patient context/history. Order: back, identity header/avatar/contact/last-next, authorized Edit, tabs Overview → Medical history → Visits → Appointments → X-rays & AI → Billing (Admin/Staff only). Desktop header 8/4, overview 7/5; 1024 stack panels; 768 one-column cards. Doctor clinical-history route preselects Visits. Edit is dialog/drawer with dirty rule; Admin has no mutations; Doctor cannot see billing.

## Appointments

### `*/appointments/day`
Purpose: day operations. Order: title/Staff `New appointment`, tabs, Today/previous/next/date, doctor/status filters, vertical timeline, selected detail drawer. 1440 timeline 9/3 detail; 1280 8/4; 1024 one doctor timeline with drawer; 768 single column timeline. Blocks show time, patient, doctor, status text/icon. Staff state actions are inside detail; Admin read-only, Doctor own/start-visit only.

### `*/appointments/week`
Purpose: weekly capacity. Same toolbar order; seven-day time grid with contained horizontal scroll at 1024/768, never tiny cards. 1440/1280 grid takes full shell; selected block opens a centered details modal. Doctor own data only; Staff mutation remains in centered modals.

### `*/appointments/month`
Purpose: low-density monthly overview (Admin/Staff only when route exists). Toolbar then calendar; cells show count/status summary, selecting date moves to Day. 1440/1280 7 columns; 1024/768 controlled horizontal calendar, no dense event prose.

### `*/appointments/list`
Purpose: filtered paginated appointments. Toolbar order tabs, date controls, doctor, status, search where backed; table columns time/patient/doctor/status/reason/chevron. 1440 full; 1280 hide reason; 1024 scroll; 768 cards. Row opens detail, not View.

### `*/appointments/needs-reschedule`, `/staff/appointments/:appointmentId/reschedule`
Purpose: resolve affected appointments. Toolbar has tabs, source/date/doctor filters. Desktop is 5/7 queue/availability detail; 1024 stack; 768 queue then sheet. Queue shows patient, original time, doctor, source, status; 4 preview only on dashboard, full route paginates. Staff chooses same-doctor slots first then alternatives, confirms one record; Admin/Doctor read-only own visibility. Create/reschedule form uses patient/doctor/date/duration controlled selectors and availability response.

### `Appointment detail`, `Create/Edit/Reschedule Appointment`
Purpose: inspect/create state. Detail order identity/status, time/doctor/patient, reason, allowed actions, audit/context. Details, forms, and status confirmation are centered modals; forms are 720 px wide, use a readable patient combobox, and retain the selected numeric ID only internally. Safe close rules apply; only changed forms prompt for discard, and submitting/status/destructive confirmation cannot dismiss by backdrop.

## Scheduling and leave

### `Clinic default shifts`, `employee schedule management`, `copy/apply default`
Purpose: Admin schedule administration at `/admin/doctors`. Order title, default-shift weekly board, employee selector, employee weekly board, Add/Edit shift, Apply defaults, Copy schedule. Desktop 5/7 master-detail, 1024 stacked, 768 one-column with horizontally contained week. Copy/apply opens impact confirmation if appointments affected; no delete terminology; pagination applies to employees when backend provides it.

### `leave list/detail/create/edit/cancel` (`/admin/leave`, `/admin/leave/:exceptionId`)
Purpose: availability exceptions. Order title/Create leave, employee/date/type/status filters, list/calendar, detail drawer. Row includes employee, range, type, cancellation state, impact count, chevron. Admin only mutation; cancel is confirmation, never DELETE. 1440 list/calendar 7/5, 1024 stack, 768 cards.

### `Doctor own schedule/leave`, `Staff own schedule/leave`
Purpose: personal visibility at `*/profile/schedule` and `*/profile/leave`. Order summary, weekly schedule or exception list, link/back. Read-only no create/edit controls; desktop 8/4 summary, tablet stack.

## Visits

### `Doctor active visit` (`/doctor/visits/active`)
Purpose: active clinical work. Order patient/appointment banner, save state, five note sections Symptoms → Diagnosis → Treatment → Clinical notes → Follow-up, X-ray secondary panel, Save, separated Complete visit. Desktop 8/4 notes/context; 1024/768 stack. Dirty state blocks close/navigation; AI never writes notes; only owning Doctor edits.

### `Doctor completed visit`, `Admin/Staff read-only visit`, `clinical history detail`
Purpose: completed/history inspection at `*/visits/:visitId` and clinical-history tab. Order context, status, notes definition sections, X-rays, handoff when allowed. Doctor sees own completed details; Staff/Admin read-only explanation. 1440 8/4, 1024/768 stack; no Edit/Complete action when locked.

## X-rays and AI

### `saved X-ray list`, `saved X-ray detail`, `upload`, `AI result/overlay`
Purpose: protected imaging at `*/xrays` and `*/xrays/:xrayId`. List order title/authorized Upload, patient/visit filters, paginated thumbnail rows (thumbnail, patient, visit, date/uploader, AI state, chevron). Detail is protected image 7/5 AI metadata; overlay toggle and zoom controls; disclaimer immediately adjacent. Upload is 720 px form with backed patient/visit selector; errors never expose URL. 1024/768 detail stacks; role upload rules preserved.

### `external X-ray list/detail`, `attach/discard/run AI`
Purpose: temporary external cases at `/admin|doctor/external-xrays*`. List filters status/date/uploader and paginates. Detail order media, temporary/attached/discarded state, AI panel, allowed actions. Doctor attach uses patient and optional own-visit combobox; Admin can upload/run/discard but not attach; Staff has no route. Discard/attach confirmation cannot accidental-close.

## Billing

### `handoff list/detail`
Purpose: workflow handoffs at `*/billing/handoffs*`. List filters status/doctor/patient/date and pages; row shows patient/visit/amount/status/creator/chevron. Detail has context, notes, amount, status and Staff-only Convert/Dismiss in separated action panel. Doctor own/read-only; Admin read-only.

### `invoice list/new/detail`, `payment history/record payment`, `print view`
Purpose: billing at `/admin|staff/billing/invoices*`. List toolbar/filter/pagination and row invoice/patient/status/total/remaining/date/chevron. New invoice order patient combobox → related visit/appointment → amount/currency → notes → side summary → sticky create. Detail 7/5 header/financial summary then payment history; Staff edit/cancel/record payment inside detail, Admin read-only. Print is A4, clinic/invoice/patient/payments, no shell. 1024 stack, 768 cards/single form.

## Admin support screens

### `clinic settings` (`/admin/clinic-settings`)
Purpose: configuration. Order summary then Clinic identity/contact, Scheduling policy, Language/currency/appearance, AI configuration; sticky save/cancel. Desktop two-column section grid; 1024/768 one column. Controls use backend choices and use field-level errors; Admin only.

### `audit list/detail` (`/admin/audit-logs`, `/admin/audit-logs/:auditLogId`)
Purpose: immutable oversight. Order title, actor/action/entity/date filters, paginated table, row drawer/page safe key/value metadata. 1440 full; 1024 scroll; 768 cards. No mutation, raw JSON, sensitive values, or generated notes.

### `access denied`, `not found`
Purpose: safe terminal state. Order icon, title, literal explanation, `Return to dashboard`; 520 px compact center with no data/action leakage; RTL/theme matched.
