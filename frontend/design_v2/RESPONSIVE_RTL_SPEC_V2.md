# Responsive, Dark, and RTL Specification v2

| Width | Shell | Content contract |
| --- | --- | --- |
| 1440 | 272 px expanded fixed sidebar; 72 px topbar | 4–5 KPIs, 2-column details, full data tables, X-ray/media 60/40 split. |
| 1280 | expanded sidebar; 72 px topbar | 3–4 KPIs, 2-column settings/forms, preserve table key columns. |
| 1024 | 84 px icon rail by default; 72 px topbar | KPI 2 columns; contained table scroll or approved card transform; schedule/calendar controlled horizontal scroll; image/detail stack. |
| 768 | labelled off-canvas drawer; 64 px topbar | 16 px padding; forms one column; dialogs near full width; dense lists become structured cards; appointment day prioritized. |
| <768 | safe fallback | no crash, one column, no clipped navigation; phone optimization deferred. |

No page-level horizontal overflow, clipped labels, arbitrary fixed content height, or overlapping shell. Use `minmax(0,…)`, containment for long email/Arabic strings, logical CSS (`padding-inline`, `margin-inline`, `inset-inline`), and no directional `left/right` unless media geometry requires it.

Theme: all token families define canvas/surface/subtle/border/text/hover/focus/selected/status/media equivalents; X-ray viewer has dark media background. Theme preference comes from `/api/me/preferences/`, respects initial system value, and persists only after backend success.

Arabic: EN/AR controls set `lang` and `dir`, persist preference, translate static strings and validation shell text; sidebar moves inline-end, breadcrumb/back/pagination/calendar directional icons mirror, close does not. Dates/numbers/currency/IDs use `dir=ltr`/bidi isolation where necessary; text labels use logical alignment and Arabic-safe line height. Visual QA validates all target widths, both themes and languages for every role.
