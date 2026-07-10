# Screen Blueprints

This file defines future screen structure without implementing full screens in Phase 13B.1.

## Appointment Workspace

Shared appointment shell:

- Page header: title, date range, doctor/status filters.
- View tabs: Day, Week, Month, List, Needs Reschedule.
- Primary body changes by tab.
- Staff sees create/reschedule/status actions.
- Doctor sees own appointments and start-visit where backend allows.
- Admin sees read-only appointment views.

Day view:

- Date selector.
- Doctor filter.
- Time-column schedule or grouped appointment list.
- Status badges visible on every appointment row/card.

Week view:

- Week selector.
- Doctor filter.
- Scrollable calendar grid.
- Appointment cards must remain readable.

Month view:

- Month selector.
- Low-density overview, not a crowded event wall.
- Click/selection may route to day/list view later.

List view:

- Full-width table/list.
- Filters for doctor, patient, status, date range.
- Pagination from backend.

Needs Reschedule view:

- Full-width tab/view, not a side panel.
- Query source: `GET /api/appointments/?status=NEEDS_RESCHEDULE`.
- Multiple `NEEDS_RESCHEDULE` appointments must render as separate rows.
- Show patient, doctor, original time, source exception when available, and Staff reschedule action.
- Reschedule action opens a focused flow with doctor selector, date selector, duration, and availability slots.

## Patient Profile

Future tab blueprint:

- Overview: demographics, contact, medical summary, general notes.
- Appointments: patient appointments list.
- Visits: visit history.
- Clinical notes: read-only history except own editable doctor visit notes where allowed.
- X-rays: saved X-rays and protected media viewer.
- AI results: saved AI result summaries and disclaimers.
- Billing: visible to Staff/Admin only; Doctor must not access invoices/payments.

Role behavior:

- Admin read-only.
- Staff edit/archive/unarchive where backend allows.
- Doctor can update allowed patient profile fields for active/non-archived patients, but cannot archive.

## Visit / Clinical Notes

Future layout:

- Active visit banner for Doctor.
- Patient context summary.
- Clinical note sections: symptoms, diagnosis, treatment, clinical notes, follow-up notes.
- Own Doctor notes editable.
- Other doctors' notes read-only.
- Complete visit action only for own active visit.
- Billing handoff CTA only after own completed visit.

## X-ray / AI

Future layout:

- Saved X-rays list with patient/visit/source filters.
- Protected media viewer using authenticated blob fetch.
- AI result panel shows status, summary, findings, confidence, overlay availability.
- AI disclaimer must appear near findings.
- External workspace is Admin/Doctor only; Staff hidden.
- Attach-to-patient is Doctor-only for own temporary external cases.

## Billing

Future layout:

- Handoffs queue for Staff with convert/dismiss actions.
- Doctor sees own handoffs only and cannot navigate to invoices/payments.
- Invoice list/detail for Staff/Admin.
- Staff creates invoices and records payments.
- Admin sees read-only billing records.
- No online payment, tax, itemization, discount, or insurance fields in MVP.
