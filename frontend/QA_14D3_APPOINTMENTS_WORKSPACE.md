# Phase 14D.3 Appointments Workspace Manual QA

Browser QA has not been executed. Exercise this matrix with the seeded Admin, Staff, and Doctor accounts before recording a browser pass.

| Area | Required verification |
| --- | --- |
| Roles | Admin and Doctor can review only; Staff can create, edit, reschedule, check in, cancel, and mark no-show only when the backend permits. |
| Views | Day, Week, Month, List, and the Staff Needs Reschedule route; direct URL load, Back/Forward, date navigation, Today, invalid query fallback. |
| Scheduling | Active patient identifier and Doctor selection, backend availability only, unavailable/past/capacity-conflicted slots, error mapping, duplicate-submit protection, stale/version conflict messaging where returned. |
| Queue | Populated, empty, loading, retry, affected context, reschedule completion, and resolved-item disappearance. |
| Presentation | 1440, 1280, 1024, and 768; Light/Dark/System; English and Arabic RTL; long names, busy days, month overflow, and contained mobile scrolling. |
| Accessibility | Keyboard calendar/day/row activation, visible focus, named controls, field-error association, dialog focus trap/Escape/focus return, 200% zoom, and RTL reading order. |
| Timezone | Run with browser timezone different from the clinic; verify Today, day/week/month boundaries, appointment time, and timestamps use response clinic metadata. |

Browser QA status: pending execution.
