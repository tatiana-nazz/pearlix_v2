# Appointment alignment browser evidence

Branch: `post-14f-medical-blue-appointments`. Baseline: `dac8cc295820e5c8d8f57a0c71a1d93ff7724c69`. Tested working-tree state: Stage 3 implementation before commit. All files are unedited browser screenshots from the local deterministic demo story. Console result was PASS (no uncaught errors); network result was PASS (no unexpected failed request observed in the rendered workflows). Permission result was PASS for each role.

| Screenshot | Role / scenario / route | State | Viewport / language / theme / direction | Measurements (inner; client / document / body) | Local scroll | Result |
| --- | --- | --- | --- | --- | --- | --- |
| `staff-appointments-day-1440x900-en-light.png` | Staff operational workspace `/staff/appointments/day?date=2026-07-22` | Day | 1440×900; EN; Light; LTR | 1440×900; 1425 / 1425 / 1425 | none | PASS |
| `staff-appointments-week-1440x900-en-light.png` | Staff `/staff/appointments/week?date=2026-07-22` | Week | 1440×900; EN; Light; LTR | 1440×900; 1425 / 1425 / 1425 | `[data-calendar-scroll=week]` 681 / 1332; seven-day grid | PASS |
| `staff-appointments-month-1440x900-en-light.png` | Staff `/staff/appointments/month?date=2026-07-22` | Month | 1440×900; EN; Light; LTR | 1440×900; 1425 / 1425 / 1425 | `[data-calendar-scroll=month]` 681 / 957; month grid | PASS |
| `staff-appointments-list-1440x900-en-light.png` | Staff `/staff/appointments/list?date=2026-07-22` | List | 1440×900; EN; Light; LTR | 1440×900; 1440 / 1440 / 1440 | `.table-scroll` 1054 / 1054 | PASS |
| `staff-appointments-needs-reschedule-1440x900-en-light.png` | Staff `/staff/appointments/needs-reschedule?date=2026-07-22` | Needs Reschedule | 1440×900; EN; Light; LTR | 1440×900; 1425 / 1425 / 1425 | `.table-scroll` 1039 / 1039 | PASS |
| `staff-appointment-details-1440x900-en-light.png` | Staff appointment detail modal | supported details/actions | 1440×900; EN; Light; LTR | 1440×900; 1425 / 1425 / 1425 | none | PASS |
| `staff-appointment-create-1440x900-en-light.png` | Staff create modal | blank supported form | 1440×900; EN; Light; LTR | 1440×900; 1425 / 1425 / 1425 | none | PASS |
| `staff-appointment-availability-1440x900-en-light.png` | Staff create modal | patient/doctor-selected live availability | 1440×900; EN; Light; LTR | 1440×900; 1425 / 1425 / 1425 | none | PASS |
| `staff-appointment-reschedule-1440x900-en-light.png` | Staff reschedule modal | current and new schedule/availability | 1440×900; EN; Light; LTR | 1440×900; 1425 / 1425 / 1425 | none | PASS |
| `staff-appointments-responsive-1024x900-en-light.png` | Staff `/staff/appointments/week?date=2026-07-22` | responsive sentinel | 1024×900; EN; Light; LTR | 1024×900; 1009 / 1009 / 1009 | `[data-calendar-scroll=week]` 453 / 1332; seven-day grid | PASS |
| `admin-appointments-1024x900-en-dark.png` | Admin `/admin/appointments/list?date=2026-07-22` | populated read-only list | 1024×900; EN; Dark; LTR | 1024×900; 1009 / 1009 / 1009 | `.table-scroll` 860 / 860 | PASS |
| `admin-appointment-details-readonly-1024x900-en-dark.png` | Admin appointment detail modal | read-only detail | 1024×900; EN; Dark; LTR | 1024×900; 1009 / 1009 / 1009 | `.table-scroll` 860 / 860 | PASS |
| `doctor-appointments-768x1024-ar-light-rtl.png` | Doctor own appointments `/doctor/appointments/day?date=2026-07-19` | checked-in/startable view | 768×1024; AR; Light; RTL | 768×1024; 753 / 753 / 753 | none | PASS |
| `doctor-appointment-details-768x1024-ar-light-rtl.png` | Doctor appointment detail modal | localized checked-in detail / Start Visit | 768×1024; AR; Light; RTL | 768×1024; 753 / 753 / 753 | none | PASS |

All page-level overflow checks passed: document scroll width and body scroll width were less than or equal to client width. Local horizontal scrolling is only used for the Week and Month calendar grids where preserving all days at their readable minimum width is required.
