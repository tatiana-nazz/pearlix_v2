# Phase 14D.2 Role Dashboard Manual QA

Automated verification is recorded in the implementation record. Browser QA has not been executed; this is the required manual matrix. Do not record a pass until each scenario is exercised with seeded local QA accounts against a running backend.

| Dimension | Required coverage |
| --- | --- |
| Roles and RBAC | Admin, Staff, and Doctor each load only their own `/api/dashboard/{role}/` response. Verify wrong-role routes/endpoints return the existing access-denied/403 behavior. |
| Admin | Verify supervisory KPIs, attention links, recent activity, Team, Users & Access, schedules, leave, and clinic settings. Confirm no create, check-in, billing mutation, or clinical action is exposed. |
| Staff | Verify today counts, queue, Needs Reschedule, checked-in attention, and operational shortcuts for New appointment, New patient, Needs Reschedule, and Billing. Confirm Team, clinic settings, and clinical visit actions are absent. |
| Doctor | Verify only own appointments, own active visit or next patient, own schedule, and patients/active-visit/appointments links. Confirm no global billing, appointment creation, check-in, or Admin action is exposed. |
| Data and time | Change the clinic timezone/date fixture where practical and confirm the heading date follows response `clinic_date` and `clinic_timezone`, not the browser clock. Confirm patient, reason, status, and appointment time data are real API values. |
| States | Exercise initial loading, populated data, empty queue/list, failed request with Retry, and Refresh while populated content remains visible. |
| Viewports | Verify 1440, 1280, 1024 compact rail, and 768 off-canvas shell in each role. Confirm no horizontal overflow, clipped actions, or obscured content. |
| Themes | Verify Light, Dark, and System with legible status, focus, and hover states. |
| Languages | Verify English and Arabic for every role. In Arabic verify RTL flow, translated dashboard labels/statuses, readable dates/numbers, and preserved LTR identifiers where present. |
| Accessibility | Verify heading order, link/button names, keyboard navigation and focus visibility, loading announcement, retry button, and semantic status labels. |

Browser QA status: pending execution.
