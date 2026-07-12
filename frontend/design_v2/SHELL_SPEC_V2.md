# Shell Specification v2

## Measurable layout

Desktop (`>=1280`): 272 px expanded sidebar or 84 px icon rail, fixed to inline start; 72 px sticky topbar; main scroll container is `calc(100vh - 72px)` and never body-plus-panel nested scrolling. At 1024, default compact rail but the persisted expanded choice may be used if content remains at least 680 px. At 768, sidebar is an off-canvas modal drawer opened by a labelled 44 px menu control; it traps focus and closes after navigation. No label may be clipped, abbreviated into letters, or generated with CSS text tricks.

Brand and bottom utilities remain fixed inside the sidebar while navigation alone scrolls. Navigation groups: Workspace, Clinical operations, Administration, Personal. Active item has primary-tinted 44 px surface, 3 px inline-start indicator, icon and text; hover/focus has a distinct surface/ring. Compact icons have tooltips and accessible names. Collapse state is stored per user preference in Phase 14C.

## Topbar

Left/right follows logical inline direction. It contains breadcrumb/page identity; contextual primary action only when that route has one; optional patient/global search only for patient, appointment, Team, or Users discovery; Light/Dark segmented control; EN/AR segmented control; and avatar/name/role menu. Profile menu includes own profile/schedule/leave where applicable and Logout. No notification item is allowed until a backed feature exists.

## Required states

Loading shell retains sidebar/topbar geometry. Permission-denied route preserves shell then explains boundary. Error cannot expose tokens. RTL moves sidebar to inline end and mirrors drawer transition, breadcrumbs, chevrons, back/next arrows, and directional calendar controls; logos, phone numbers, email, amounts, and dates use isolated direction where required.
