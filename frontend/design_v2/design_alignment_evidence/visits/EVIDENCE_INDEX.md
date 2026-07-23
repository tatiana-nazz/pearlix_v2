# Stage 7 visit evidence

Branch: `post-14f-medical-blue-visits`
Source commit: `7e048bfc11d6fef6aeabe393c4a1c7a43e945885`
Implementation commit: `1cc67e199473d662859c21c76127093f6ab555b7`
Deterministic state: `seed_demo_clinic_story --reset-demo --include-must-change-user --reference-date 2026-07-19`.

Pre-change captures were served from a detached worktree at the source commit; post-change captures were served from the active implementation branch. Terminal Playwright drove Microsoft Edge through local authenticated sessions. The render gate required HTTP 200 navigation, complete ready state, a populated `#root`, visible text, successful JS/CSS assets, and no document/body overflow. The recorded viewports have matching inner/client/document/body widths; any table scrolling is local to its bounded surface.

| Evidence | Role / route / state | Viewport |
| --- | --- | --- |
| `before/doctor-active-visit-before-1440x900-en-light.png` | Doctor active visit | 1440x900 EN light LTR |
| `before/doctor-visit-notes-before-1440x900-en-light.png` | Doctor active visit, Notes | 1440x900 EN light LTR |
| `before/doctor-visit-history-before-1440x900-en-light.png` | Doctor active visit, History | 1440x900 EN light LTR |
| `before/doctor-visit-xrays-before-1440x900-en-light.png` | Doctor active visit, X-rays & AI | 1440x900 EN light LTR |
| `before/doctor-visit-appointment-before-1440x900-en-light.png` | Doctor active visit, Appointment info | 1440x900 EN light LTR |
| `before/doctor-complete-visit-before-1440x900-en-light.png` | Doctor active visit, completion confirmation | 1440x900 EN light LTR |
| `before/staff-visit-readonly-before-1024x900-en-dark.png` | Staff direct visit, readonly | 1024x900 EN dark LTR |
| `before/admin-visit-readonly-before-1024x900-en-dark.png` | Admin direct visit, readonly | 1024x900 EN dark LTR |
| `before/doctor-visit-before-768x1024-ar-light-rtl.png` | Doctor active visit, Arabic RTL | 768x1024 AR light RTL |
| `before/doctor-no-active-visit-before-768x1024-en-light.png` | Doctor no-active-visit recovery | 768x1024 EN light LTR |
| `after/doctor-active-visit-after-1440x900-en-light.png` | Doctor active visit | 1440x900 EN light LTR |
| `after/doctor-visit-notes-after-1440x900-en-light.png` | Doctor active visit, Notes | 1440x900 EN light LTR |
| `after/doctor-visit-dirty-notes-after-1440x900-en-light.png` | Doctor modified Notes, no save | 1440x900 EN light LTR |
| `after/doctor-visit-history-after-1440x900-en-light.png` | Doctor active visit, History | 1440x900 EN light LTR |
| `after/doctor-visit-xrays-after-1440x900-en-light.png` | Doctor active visit, X-rays & AI | 1440x900 EN light LTR |
| `after/doctor-visit-appointment-after-1440x900-en-light.png` | Doctor active visit, Appointment info | 1440x900 EN light LTR |
| `after/doctor-visit-billing-context-after-1440x900-en-light.png` | Doctor Appointment info, embedded Billing context | 1440x900 EN light LTR |
| `after/doctor-complete-visit-after-1440x900-en-light.png` | Doctor completion confirmation | 1440x900 EN light LTR |
| `after/doctor-discard-visit-changes-after-1440x900-en-light.png` | Doctor dirty route-block confirmation | 1440x900 EN light LTR |
| `after/doctor-completed-visit-after-1440x900-en-light.png` | Doctor completed direct visit; completion locked while owner-note editing remains contractually available | 1440x900 EN light LTR |
| `after/staff-visit-readonly-after-1024x900-en-dark.png` | Staff direct visit, readonly | 1024x900 EN dark LTR |
| `after/admin-visit-readonly-after-1024x900-en-dark.png` | Admin direct visit, readonly | 1024x900 EN dark LTR |
| `after/doctor-visit-after-768x1024-ar-light-rtl.png` | Doctor active visit, Arabic RTL | 768x1024 AR light RTL |
| `after/doctor-visit-responsive-after-768x1024-en-light.png` | Doctor responsive sentinel | 768x1024 EN light LTR |
| `after/doctor-no-active-visit-after-768x1024-en-light.png` | Doctor no-active-visit recovery | 768x1024 EN light LTR |

Doctor mutation evidence stops before confirmation submission: no completion or save mutation was performed; the dirty-state capture uses the route-blocker's Discard path only. Staff and Admin evidence confirms no clinical-note save, completion, X-ray mutation, or Billing mutation control. The deterministic no-active-visit route records its expected `NO_ACTIVE_VISIT` 404 and renders the empty recovery state; no other required request failed. The existing React Router future-flag warning is non-blocking.
