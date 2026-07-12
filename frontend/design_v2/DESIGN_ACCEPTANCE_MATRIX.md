# Design Acceptance Matrix

| Contract | Evidence required in 14C–14F |
| --- | --- |
| Shell/utilities | 1440 expanded, 1024 icon rail, 768 drawer screenshots; persisted collapse; sticky topbar/content scroll; Light/Dark and EN/AR functional. |
| Icons/accessibility | Lucide map used; no text-letter compact nav; keyboard/focus/tooltip/accessible-name test for every icon-only control. |
| Color/depth | token audit; contrast ≥4.5:1 text; semantic icon/text; light/dark hover/focus/selected screenshots. |
| Dashboard | Admin/Staff/Doctor seeded views: 3–5 KPIs, valid quick action, KPI/queue navigation, 4–6 preview + Show more/Collapse. |
| Lists/tables | patient/appointment/invoice/user/Team/audit/X-ray/handoff/schedule/leave show shell, toolbar/header, row focus, paginated state, 768 transform/scroll. |
| Patient row | avatar/name/age-gender/contact/last-next/status/chevron; full-row detail activation; no View button. |
| Forms | settings/new patient/new user/invoice/appointment: groups, selected controlled fields, errors/help, dirty discard, tablet fallback. |
| Overlays | outside/Escape only safe overlays; close/focus trap/return; dirty and submitting/destructive tests. |
| Team/access | separate nav/route/list/detail; supported fields only; role/reset/deactivate rules; profile API dependencies completed before edit. |
| Screens | every `SCREEN_SPECS_V2` route tested seeded, loading, empty, error, permitted/read-only/locked as applicable. |
| Responsive/RTL | each role at four widths, light/dark, EN/AR with no clipping/overflow and correct mirrored direction. |

Failure of any row blocks Phase 14G.
