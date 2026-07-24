# Phase 14D.1 Team and Users & Access Manual QA

Automated verification is recorded in the implementation record. Browser QA has not been executed; this is the required manual matrix. The clean-main and feature-branch backend suites both have the same 28 pre-existing failures, outside this Team and Users & Access slice.

| Dimension | Required coverage |
| --- | --- |
| Roles | Admin allowed; Staff denied; Doctor denied for every `/admin/team*` and `/admin/users*` route. |
| Viewports | 1440, 1280, 1024 compact rail, and 768 off-canvas navigation. |
| Themes | Light, Dark, and System. |
| Languages | English and Arabic RTL, including readable emails and numbers. |
| Team | List/search/role-status-availability filters/pagination; loading, empty, error/retry; keyboard row opening; Doctor and Staff creation; profile update/version conflict/reload; professional deactivate/reactivate; linked account navigation. |
| Users & Access | List/loading/empty/error/pagination; Admin-only creation; linked Team navigation and integrity warning; identity edit; reset password; deactivate and reactivate. |
| Role transition | Preview blocked; preview allowed; target profile fields; confirmation token; expired token and version conflict messaging; successful destination and refreshed data. |
| Accessibility | Accessible form labels/errors; row Enter/Space activation; modal focus, Escape, outside click, and pending-operation lock. |

Do not record a pass until a seeded browser session has exercised the listed scenario.
