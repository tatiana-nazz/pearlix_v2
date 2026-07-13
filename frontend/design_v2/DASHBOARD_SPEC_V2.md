# Dashboard Specification v2

Dashboard data is operational, not navigation filler. Every KPI is a labelled link; every preview is four seeded rows initially, Show more reveals at most four more (maximum eight), Collapse restores four, and View all routes to a paginated/filter-preserved screen. Skeletons use KPI/row geometry; empty state names the absent work and exposes only valid action; error is local with Retry. Rows are full detail links with patient/record identity, primary time/value, status icon/text, contextual reason, and chevron.

## Admin — `/admin/dashboard`

| Order | KPI label, support, icon/emphasis | Click destination |
| --- | --- | --- |
| 1 | Active patients — `Active records`; `UsersRound`, neutral/primary | `/admin/patients?archive=active` |
| 2 | Today’s appointments — local date; `CalendarDays`, info | `/admin/appointments/list?date={today}` |
| 3 | Needs reschedule — `Requires scheduling review`; `CalendarSync`, warning | `/admin/appointments/needs-reschedule?status=NEEDS_RESCHEDULE` |
| 4 | Pending handoffs — `Awaiting Staff conversion`; `ReceiptText`, warning | `/admin/billing/handoffs?status=PENDING` |
| 5 | Unpaid invoices — `Outstanding balance`; `CircleDollarSign`, warning | `/admin/billing/invoices?status=UNPAID` |

Sections are exact order: Needs attention (reschedules then pending handoffs; rows patient, original date/time, doctor/amount, status/reason) → Recent appointments (patient, time, doctor, status) → Recent audit activity (actor, action, entity, timestamp) → Clinic summary (checked-in/active visits/unpaid count as plain facts). Quick actions: `Clinic settings`, `Users & Access`; no create patient/appointment/payment, notification, system-health, or generic module cards. At 1440 KPI five-up then 8/4 attention/audit; 1280 3+2 then 7/5; 1024 2+2+1 then stacked sections; 768 one-column. All content is read-only.

## Staff — `/staff/dashboard`

| Order | KPI label, support, icon/emphasis | Click destination |
| --- | --- | --- |
| 1 | Today’s appointments — `Clinic schedule`; `CalendarDays`, primary | `/staff/appointments/list?date={today}` |
| 2 | Checked in — `Ready for Doctor`; `BadgeCheck`, success | `/staff/appointments/list?date={today}&status=CHECKED_IN` |
| 3 | Needs reschedule — `Requires follow-up`; `CalendarSync`, warning | `/staff/appointments/needs-reschedule?status=NEEDS_RESCHEDULE` |
| 4 | Pending handoffs — `Billing queue`; `ReceiptText`, warning | `/staff/billing/handoffs?status=PENDING` |
| 5 | Unpaid or partial invoices — `Collect or review`; `CircleDollarSign`, warning | `/staff/billing/invoices?status=UNPAID,PARTIALLY_PAID` |

Sections: Upcoming today (patient, time, doctor, appointment status) → Checked-in queue (patient, check-in time, doctor, status) → Needs reschedule (patient, original slot, source, status) → Pending billing handoffs (patient, visit, suggested amount, status) → Recent patients (name, contact, next appointment) → Own schedule and leave (weekday/range, status). Quick actions exactly `New appointment` and `Find patient`; no clinician start-visit, invoice payment shortcut, or duplicate navigation cards. The approved Staff primary KPI composition is four cards: today, checked in, needs reschedule, and unpaid/partial invoices. Pending handoffs remain a secondary queue. At 1440 the four cards share one row; at 1024 they use two-up layout; at 768 one column. Staff queue action is never executed directly from a dashboard row; row opens the source detail.

## Doctor — `/doctor/dashboard`

| Order | KPI label, support, icon/emphasis | Click destination |
| --- | --- | --- |
| 1 | Today’s appointments — `Assigned to you`; `CalendarDays`, primary | `/doctor/appointments/list?date={today}` |
| 2 | Checked in — `Ready to start`; `BadgeCheck`, success | `/doctor/appointments/list?date={today}&status=CHECKED_IN` |
| 3 | Active visit — `Current clinical work`; `Stethoscope`, info | `/doctor/visits/active` |
| 4 | Needs reschedule — `Own affected appointments`; `CalendarSync`, warning | `/doctor/appointments/needs-reschedule?status=NEEDS_RESCHEDULE` |
| 5 | Completed today — `Own completed visits`; `ClipboardCheck`, success | `/doctor/appointments/list?date={today}&status=COMPLETED` |

Above KPIs is active-visit banner only if it exists: patient, start time, status, `Resume active visit`; otherwise it is absent, not an empty giant card. Sections: Next patient/today schedule (patient, time, reason, status) → Checked-in (patient, time, start eligibility) → Recent visits (patient, started/completed, status) → Needs reschedule (patient, original slot, reason) → Own pending handoffs (patient, visit, amount/status) → Own schedule/leave (weekday/range/status). Quick action is `Resume active visit`, or `Start visit` only for a valid selected checked-in appointment; no invoice/payment/global settings. Layout: 1440 banner, five-up, 7/5; 1280 3+2; 1024 2+2+1 and stack; 768 one-column. Every route remains own-record scoped.
