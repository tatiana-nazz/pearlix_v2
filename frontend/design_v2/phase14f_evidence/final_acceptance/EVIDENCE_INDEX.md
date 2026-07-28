# Phase 14F Final Acceptance Evidence Index

All screenshots are unedited local-browser captures at tested viewports. Results are recorded in `../../PHASE_14F_BROWSER_AUDIT.md`.

| Screenshot | Role / route | Viewport / preference | Assertion / result |
| --- | --- | --- | --- |
| `staff-dashboard-1440x900-en-light.png` | Staff `/staff/dashboard` | 1440×900 EN Light | Four KPIs load; fourth is clipped by overflow — FAIL. |
| `staff-team-cards-1440x900-en-light.png` | Staff `/staff/team` | 1440×900 EN | Directory request 403 — FAIL. |
| `staff-appointments-day-1440x900-en-light.png` | Staff appointments Day | 1440×900 EN | Real Day data loaded. |
| `staff-appointments-week-1440x900-en-light.png` | Staff appointments Week | 1440×900 EN | Real Week data loaded. |
| `staff-appointments-month-1440x900-en-light.png` | Staff appointments Month | 1440×900 EN | Real Month data loaded. |
| `staff-patients-1440x900-en-light.png` | Staff patients | 1440×900 EN | Active/archived story available. |
| `staff-patient-profile-1440x900-en-light.png` | Staff patient profile | 1440×900 EN | Linked patient detail loaded. |
| `staff-billing-handoffs-1440x900-en-light.png` | Staff billing handoffs | 1440×900 EN | Pending handoff loaded. |
| `staff-billing-invoices-1440x900-en-light.png` | Staff invoices | 1440×900 EN | Unpaid/partial/paid states loaded. |
| `staff-invoice-detail-payment-1440x900-en-light.png` | Staff invoice detail | 1440×900 EN | Payment controls/detail loaded. |
| `staff-invoice-print-1440x900-en-light.png` | Staff invoice print | 1440×900 EN | Printable route loaded. |
| `admin-dashboard-1024x900-en-dark.png` | Admin dashboard | 1024×900 EN Dark | Narrow one-column geometry / overflow — FAIL. |
| `admin-team-setup-required-1024x900-en-dark.png` | Admin Team | 1024×900 EN Dark | Initial Team capture; setup-required data triggered the subsequent error. |
| `admin-team-runtime-error-1024x900-en-dark-14F-FINAL-03.png` | Admin Team | 1024×900 EN Dark | Uncaught setup-required record crash — FAIL. |
| `admin-schedules-1024x900-en-dark.png` | Admin schedules | 1024×900 EN Dark | Schedules loaded. |
| `admin-leave-1024x900-en-dark.png` | Admin leave | 1024×900 EN Dark | Leave lifecycle records loaded. |
| `admin-clinic-settings-1024x900-en-dark.png` | Admin settings | 1024×900 EN Dark | Configured values loaded. |
| `admin-audit-1024x900-en-dark.png` | Admin audit | 1024×900 EN Dark | Audit collection loaded. |
| `doctor-dashboard-viewport-768x1024-ar-light-rtl-14F-FINAL-01.png` | Doctor active visit | 768×1024 AR Light RTL | Visible horizontal scrollbar — FAIL. |
| `doctor-dashboard-768x1024-ar-light-rtl-14F-FINAL-01.png` | Doctor dashboard | 768×1024 AR Light RTL | Shell Arabic; full-page overflow — FAIL. |
| `doctor-active-visit-error-768x1024-ar-light-rtl-14F-FINAL-05.png` | Doctor no-active-visit | 768×1024 AR Light RTL | Error/Retry rather than empty state — FAIL. |
| `doctor-active-visit-empty-768x1024-ar-light-rtl.png` | Doctor no-active-visit | 768×1024 AR Light RTL | Initial route capture before settled error state. |
| `doctor-active-visit-data-768x1024-ar-light-rtl.png` | Doctor active visit | 768×1024 AR Light RTL | Linked active visit data loaded. |
| `doctor-appointments-day-768x1024-ar-light-rtl.png` | Doctor appointments | 768×1024 AR Light RTL | Authorized Day view loaded. |
| `doctor-patients-768x1024-ar-light-rtl.png` | Doctor patients | 768×1024 AR Light RTL | Linked patient list loaded. |
| `doctor-xrays-ai-data-768x1024-ar-light-rtl.png` | Doctor X-rays/AI | 768×1024 AR Light RTL | Saved mock-AI data loaded. |
| `doctor-xray-ai-detail-768x1024-ar-light-rtl.png` | Doctor X-ray detail | 768×1024 AR Light RTL | Protected linked X-ray detail loaded. |
| `doctor-xrays-768x1024-ar-light-rtl.png` | Doctor X-rays/AI | 768×1024 AR Light RTL | Doctor One collection capture before Doctor Two linked-data pass. |
| `doctor-billing-handoffs-768x1024-ar-light-rtl.png` | Doctor billing handoffs | 768×1024 AR Light RTL | Doctor collection loaded. |
