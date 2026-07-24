# Stage 9 Admin and supporting evidence index

Source branch/commit: `post-14f-medical-blue-xrays-ai` / `7253ebd78cfd5ae23fd52c71c9dccda9eb6724f0`. Stage branch: `post-14f-medical-blue-admin-supporting`. Implementation: `d5fe795fb291bdd50b22626b25caaf70f3f4d5e6`. Browser method: terminal Playwright with Microsoft Edge and isolated contexts; deterministic demo seed restored before final captures.

All captures reached a complete document with a root child, passed document overflow (`scrollWidth <= clientWidth`), and used no full-page document overflow. Audit local scroll containers were bounded; settings forms had equal client/scroll widths. The only console item was the expected 404 from the intentional unknown-route not-found capture; no application error, page error, failed API request, or unexpected CSS/JavaScript failure occurred.

| Evidence | Role / route / state | Viewport / locale / theme / dir | Permission and result |
| --- | --- | --- | --- |
| `before/admin-clinic-settings-before-1440x900-en-light.png` | Admin `/admin/clinic-settings`, read | 1440×900, EN/light/LTR | Authorized; GET settings; PASS |
| `before/admin-clinic-settings-edit-before-1440x900-en-light.png` | Admin settings, dirty edit (not saved) | 1440×900, EN/light/LTR | Authorized; no mutation; PASS |
| `before/admin-audit-log-before-1440x900-en-light.png` | Admin `/admin/audit-logs`, populated | 1440×900, EN/light/LTR | Authorized read-only; PASS |
| `before/admin-audit-filtered-before-1440x900-en-light.png` | Admin audit filtered | 1440×900, EN/light/LTR | Existing URL filter; PASS |
| `before/admin-supporting-before-1024x900-en-dark.png` | Admin audit | 1024×900, EN/dark/LTR | Authorized read-only; local table bounded; PASS |
| `before/admin-supporting-before-768x1024-ar-light-rtl.png` | Admin settings | 768×1024, AR/light/RTL | Authorized; controls reachable; PASS |
| `before/supporting-permission-denied-staff-before-768x1024-en-light.png`, `before/supporting-permission-denied-doctor-before-768x1024-en-light.png` | Staff/Doctor direct Admin settings | 768×1024, EN/light/LTR | Existing RoleGuard denial; safe return; PASS |
| `before/supporting-not-found-before-768x1024-en-light.png` | Authenticated unknown route | 768×1024, EN/light/LTR | Existing not-found; safe return; PASS |
| `after/admin-clinic-settings-after-1440x900-en-light.png` | Admin settings read | 1440×900, EN/light/LTR | Authorized; restored deterministic state; PASS |
| `after/admin-clinic-settings-edit-after-1440x900-en-light.png`, `after/admin-clinic-settings-validation-after-1440x900-en-light.png` | Admin settings dirty/validation | 1440×900, EN/light/LTR | No save; exact existing validation; PASS |
| `after/admin-audit-log-after-1440x900-en-light.png`, `after/admin-audit-filtered-after-1440x900-en-light.png` | Admin audit populated/filtered | 1440×900, EN/light/LTR | Immutable read-only register; PASS |
| `after/admin-supporting-after-1024x900-en-dark.png` | Admin audit | 1024×900, EN/dark/LTR | Contrast and local scroll verified; PASS |
| `after/admin-supporting-after-768x1024-ar-light-rtl.png` | Admin settings | 768×1024, AR/light/RTL | Inner viewport exact; controls reachable; PASS |
| `after/supporting-permission-denied-staff-after-768x1024-en-light.png`, `after/supporting-permission-denied-doctor-after-768x1024-en-light.png` | Staff/Doctor direct Admin settings | 768×1024, EN/light/LTR | Existing denial without route leakage; PASS |
| `after/supporting-not-found-after-768x1024-en-light.png` | Authenticated unknown route | 768×1024, EN/light/LTR | Existing not-found; PASS |

Unavailable active-runtime captures: synthetic settings/audit loading, error, and empty states were not fabricated; their supported component retry/empty/error behavior is covered by existing focused tests. No settings mutation was performed in browser QA, and audit history was never edited or deleted.
