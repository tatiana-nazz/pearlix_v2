# Component Specification v2

All components inherit tokens, light/dark/EN/AR/RTL, keyboard focus, responsive behavior, loading/empty/error/disabled/read-only states, and role checks below. Current defects are giant equal cards, weak hierarchy, browser-default inputs, isolated row actions, and inconsistent overlay semantics.

| Component | Target contract and measurable acceptance |
| --- | --- |
| `PageHeader` | Breadcrumb/context + 32 px title + one sentence; at most one primary page action; actions wrap below title at 768; no technical eyebrow/copy. |
| `Card`/section | 16 px radius, 24/20 px padding, 1 px border, shadow only for major work surface; header/body/action slots; clickable collection card has keyboard activation, hover/focus elevation and `ChevronRight`, while record actions remain in its detail surface. |
| KPI | 3–5 per dashboard, 160 px minimum, 24 px icon tile, label/value/support line; entire authorized KPI links to filtered queue. |
| Button/menu | 44 px standard, 36 px compact; primary one per scope; record-specific overflow is detail-only, never a collection control; destructive uses secondary placement and confirmation. |
| Status | icon + text + semantic token; 12/18 label; no sole color; supports state legend in dense calendar. |
| Tabs | 44 px target, selected indicator at logical inline end/start aware; horizontal scroll has accessible label and no nested page scroll. |
| List/table shell | title/count, 16 px toolbar, distinct 40 px column header, separators or 2% alternating fill, row hover/focus/selected; 24 px gap between independent shells. |
| Detail header | summary + authorized Edit top-end; mutation panels below; close/back/return behavior clearly labelled. |
| Form | 44 px controls, 8 px label/control, 6 px help/error; 2 cols at ≥1024 and one at ≤1023; grouped sections and sticky action bar. |
| State panel | skeleton matches target geometry; empty has icon/title/action; error offers retry where safe; read-only names role boundary; locked names reason. |

Every click target is operable by Enter/Space, focus returns predictably, text contrast is ≥4.5:1, and no component uses a fixed content height that hides records.
