# Phase 14D Browser Acceptance Record

The Phase 14D browser acceptance gate is closed. Live local-browser execution covered Admin, Staff, and Doctor surfaces at 1440, 1280, 1024, and 768 responsive breakpoints in English light and Arabic dark states. The checklist is `frontend/QA_14D_BROWSER_ACCEPTANCE.md`.

Browser testing closed two shell defects: the mobile RTL off-canvas sidebar could create document-level horizontal overflow, and static Phase 14D navigation labels were not localized. `Shell.css` clips horizontal overflow at the shell boundary; the shell dictionary now supplies translated navigation, role-workspace, navigation-region, and collapse/expand labels. Focused contracts cover both repairs.

Admin dashboard/Team/Users, Staff dashboard/appointments/patients, Doctor dashboard/patients/action boundaries, responsive RTL, and the three-case Playwright smoke suite all passed. No backend endpoint, serializer, permission, API contract, or migration changed. Browser evidence is intentionally outside version control.
