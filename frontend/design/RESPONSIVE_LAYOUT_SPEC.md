# Responsive Layout Spec

The MVP minimum supported width is 768px. Below 768px the app should not crash, but phone optimization is not part of MVP.

## Breakpoints

| Target | Width | Sidebar | Topbar | Page Padding | Dashboard Cards |
| --- | --- | --- | --- | --- | --- |
| Desktop XL | 1440px+ | 264px | 72px | 32px | 4 columns |
| Laptop | 1280-1439px | 248px | 72px | 28px | 3-4 columns |
| Small laptop / large tablet landscape | 1024-1279px | 232px or compact if needed | 72px | 24px | 2-3 columns |
| Tablet | 768-1023px | Compact 72px | 64px | 16-20px | 1-2 columns |
| Below MVP | <768px | Stacked fallback allowed | 64px | 16px | 1 column |

## Shell Rules

- Sidebar remains left-aligned on all supported MVP widths.
- Tablet sidebar is compact. Future icon navigation should use recognizable icons with tooltips.
- Topbar remains fixed-height visually, but does not need CSS `position: fixed`.
- Content must never overlap the sidebar or topbar.
- Text inside buttons, badges, cards, and nav must not overflow its container.

## Page Grid Rules

Dashboard cards:

- Desktop XL: 4 equal columns.
- Laptop: 3-4 columns depending on content length.
- Small laptop: 2-3 columns.
- Tablet: 1-2 columns.

Operational lists:

- Tables can horizontally scroll inside a full-width surface.
- Do not shrink columns until labels become unreadable.
- Calendar day/week/month grids may scroll horizontally on tablet.

Forms:

- Use one column for narrow panels.
- Use two columns only when fields are short and closely related.
- Field validation appears below the relevant input.

## Calendar Rules

- Appointment Day, Week, Month, List, and Needs Reschedule are top-level appointment views.
- Needs Reschedule is a tab/view, not a side panel.
- Multiple `NEEDS_RESCHEDULE` appointments render in a full-width list or table.
- Reschedule drawer/modal may be introduced later, but the source queue remains the full-width tab.

## Protected Media Rules

X-ray and AI overlay media must preserve inspection quality. Do not crop aggressively. Use a stable media frame with overflow controls if needed.
