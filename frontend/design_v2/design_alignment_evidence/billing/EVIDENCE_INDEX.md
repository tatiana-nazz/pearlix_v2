# Stage 6 billing evidence

Branch: `post-14f-medical-blue-billing`  
Source commit: `c46c3b000873593623fdb588dab09ff52523dabe`  
Implementation commit: pending finalization  
Deterministic state: `seed_demo_clinic_story --reset-demo --include-must-change-user --reference-date 2026-07-19`.

The recorded captures use isolated Staff and Admin local sessions. No confirmation mutation was performed. Local table scrolling is acceptable; document and body width did not exceed client width in recorded desktop routes.

| Evidence | Role / route / state | Viewport and result |
| --- | --- | --- |
| `after/staff-billing-workspace-after-1440x900-en-light.png` | Staff `/staff/billing`, populated invoice register | 1440×900 EN light LTR; 1440/1440/1440 pass |
| `after/staff-invoice-details-after-1440x900-en-light.png` | Staff direct unpaid invoice | 1440×900 EN light LTR; no overflow pass |
| `after/staff-payment-dialog-after-1440x900-en-light.png` | Staff unpaid invoice payment dialog | 1440×900 EN light LTR; no mutation pass |
| `after/staff-invoice-edit-after-1440x900-en-light.png` | Staff unpaid invoice edit dialog | 1440×900 EN light LTR; no mutation pass |
| `after/staff-invoice-cancel-after-1440x900-en-light.png` | Staff unpaid invoice cancellation confirmation | 1440×900 EN light LTR; no mutation pass |
| `after/staff-invoice-print-after-a4-en-light.png` | Staff invoice print route | print route; 1425/1425/1425 pass |
| `after/admin-billing-after-1024x900-en-dark.png` | Admin `/admin/billing`, read-only register | 1024×900 EN dark LTR; 1024/1024/1024 pass |
| `after/admin-invoice-readonly-after-1024x900-en-dark.png` | Admin direct invoice detail, read-only | 1024×900 EN dark LTR; 1024/1024/1024 pass |

Handoff-list and Doctor billing paths are redirected/dormant as described in the active route inventory; no route was activated for evidence. Console contained only the existing React Router future-flag warning; no blocking console or network failure was observed.
