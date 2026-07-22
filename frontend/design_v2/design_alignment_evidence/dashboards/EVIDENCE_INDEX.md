# Stage 2 dashboard browser evidence

- Branch: `post-14f-medical-blue-dashboards`
- Baseline commit: `25ebd632d812ce68a4356479f2db24d1cbc7a88a`
- Implementation commit: pending final reference commit.
- QA data: deterministic demo story seeded with reference date 2026-07-19.

| Screenshot | Tested state | Role / route | Viewport | Language / theme / direction | Inner dimensions | Client / document / body widths | Overflow | Console / network | Interaction state | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `staff-dashboard-1440x900-en-light.png` | Populated Staff dashboard | Staff `/staff/dashboard` | 1440x900 | EN / Light / LTR | 1440x900 | 1425 / 1425 / 1425 | PASS | PASS / PASS | Default dashboard state | PASS |
| `admin-dashboard-1024x900-en-dark.png` | Populated Admin dashboard | Admin `/admin/dashboard` | 1024x900 | EN / Dark / LTR | 1024x900 | 1009 / 1009 / 1009 | PASS | PASS / PASS | Default dashboard state | PASS |
| `doctor-dashboard-768x1024-ar-light-rtl.png` | Doctor dashboard with valid empty queue | Doctor `/doctor/dashboard` | 768x1024 | AR / Light / RTL | 768x1024 | 768 / 768 / 768 | PASS | PASS / PASS | Upcoming queue selected | PASS |
| `doctor-dashboard-queue-tabs-768x1024-ar-light-rtl.png` | Doctor queue after all tabs were exercised | Doctor `/doctor/dashboard?queue=cancelled&cancelled_status=NO_SHOW` | 768x1024 | AR / Light / RTL | 768x1024 | 768 / 768 / 768 | PASS | PASS / PASS | Cancelled/No-Show tab selected; No-Show selector active | PASS |

Console result records no uncaught application error. Network result records no unexpected failed request. No passwords, tokens, or local database IDs are included.
