# Medical-blue foundation browser evidence

Tested state: `post-14f-medical-blue-foundation pre-commit working tree based on 324a0377161fa1d83e3d1eed702cfc105488b7c8`.

| Screenshot | Role / route | Requested viewport | Language / theme / direction | Client / document / body widths | Result |
| --- | --- | --- | --- | --- | --- |
| `staff-dashboard-1440x900-en-light.png` | Staff `/staff/dashboard` | 1440×900 | EN / Light / LTR | 1425 / 1425 / 1425 | PASS; no console errors observed. |
| `staff-appointment-create-modal-1440x900-en-light.png` | Staff appointment create modal | 1440×900 | EN / Light / LTR | 1425 / 1425 / 1425 | PASS; modal rendered with no document overflow. |
| `admin-dashboard-1024x900-en-dark.png` | Admin `/admin/dashboard` | 1024×900 | EN / Dark / LTR | 1009 / 1009 / 1009 | PASS; no console errors observed. |
| `admin-team-1024x900-en-dark.png` | Admin `/admin/team` | 1024×900 | EN / Dark / LTR | 1009 / 1009 / 1009 | PASS; no console errors observed. |
| `doctor-dashboard-768x1024-ar-light-rtl.png` | Doctor `/doctor/dashboard` | 768×1024 | AR / Light / RTL | `window.innerWidth` 768; client / document / body 768 / 768 / 768 | PASS; no console errors or unexpected failed requests observed. |
| `doctor-navigation-drawer-768x1024-ar-light-rtl.png` | Doctor drawer open | 768×1024 | AR / Light / RTL | `window.innerWidth` 768; client / document / body 768 / 768 / 768 | PASS; drawer open, no console errors or unexpected failed requests observed. |
