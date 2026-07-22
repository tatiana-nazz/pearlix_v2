# DentalCare Frontend Design System Source of Truth

## Purpose

This document defines the DentalCare / pearlix frontend visual design system.

Future frontend fixes must preserve the existing design language while improving backend/frontend logic. Codex must not randomly redesign pages, introduce new palettes, change spacing systems, or rebuild existing layouts while fixing bugs.

This file should be used together with:

- `project_docs/FRONTEND_V1_SOURCE_OF_TRUTH.md`
- `project_docs/ROLE_PERMISSION_SOURCE_OF_TRUTH.md`

## 1. Design Identity

DentalCare is a clean medical SaaS interface.

The design must feel:

- professional
- calm
- clinical
- organized
- soft
- modern
- trustworthy

The design must not feel:

- flashy
- colorful/random
- black-heavy
- crowded
- harsh
- experimental
- game-like

The visual system uses:

- white cards
- soft blue-gray backgrounds
- medical blue accents
- dark navy headings
- muted blue-gray labels
- rounded cards
- subtle borders
- soft shadows
- semantic status colors only

Codex must not redesign the app while fixing backend/frontend logic.

## 2. Global Layout

### App shell

The app uses this structure:

- left sidebar
- top header
- main content area
- cards inside content
- drawers/modals above content

### Layout dimensions

```css
:root {
  --sidebar-width: 280px;
  --sidebar-collapsed-width: 88px;
  --topbar-height: 76px;

  --page-padding-x: 32px;
  --page-padding-y: 32px;

  --content-gap: 24px;
  --section-gap: 28px;
  --card-gap: 20px;
}
```

### Page background

Use a soft blue-gray page background, not pure white.

```css
:root {
  --color-page-bg: #F4F7FC;
  --color-page-bg-soft: #F7FAFF;
}
```

Used for:

- main app background
- page body
- dashboard pages
- appointments page
- patients page
- billing page
- settings page
- doctor workspace pages

## 3. Color System

### Brand colors

```css
:root {
  --color-primary: #3F6DF6;
  --color-primary-hover: #315BE0;
  --color-primary-active: #244BC5;
  --color-primary-soft: #EAF0FF;
  --color-primary-soft-strong: #DCE7FF;
  --color-primary-border: #C9D8FF;

  --color-secondary: #4AA3F5;
  --color-secondary-soft: #EEF7FF;
}
```

Used for:

- primary buttons
- active sidebar item
- selected tabs
- selected calendar view
- focused input border
- links
- important icons
- active nav indicators

Rules:

- Do not use primary blue for every text element.
- Use primary blue for actions, selected states, and important highlights.
- Do not introduce unrelated accent colors.

### Surface colors

```css
:root {
  --color-surface: #FFFFFF;
  --color-surface-muted: #F8FAFD;
  --color-surface-hover: #F2F6FF;
  --color-surface-selected: #EAF0FF;
  --color-surface-disabled: #F1F5F9;
}
```

Used for:

- cards
- drawers
- modals
- tables
- input backgrounds
- schedule slots
- profile panels
- stat cards
- invoice detail cards
- appointment cards

### Text colors

```css
:root {
  --color-text-main: #0F1F3A;
  --color-text-heading: #0B1B34;
  --color-text-secondary: #52657F;
  --color-text-muted: #8A9AB0;
  --color-text-disabled: #A8B4C5;
  --color-text-inverse: #FFFFFF;
}
```

Usage:

- page title: `--color-text-heading`
- section title: `--color-text-main`
- body text: `--color-text-secondary`
- labels: `--color-text-muted`
- disabled text: `--color-text-disabled`
- button text on blue: `--color-text-inverse`

### Borders

```css
:root {
  --color-border-subtle: #EDF2FA;
  --color-border: #E3EAF5;
  --color-border-strong: #D4DEEC;
  --color-border-focus: #3F6DF6;
}
```

Used for:

- cards
- tables
- inputs
- modals
- drawers
- appointment slots
- filter boxes
- profile sections
- billing detail panels

Rules:

- Default border: `1px solid #E3EAF5`
- Light section border: `1px solid #EDF2FA`
- Focused input border: `#3F6DF6`
- Avoid dark borders.
- Avoid thick borders except active sidebar indicator.

## 4. Semantic Status Colors

Status colors are for meaning only. Do not use them decoratively.

```css
:root {
  /* Success */
  --color-success: #16A36A;
  --color-success-bg: #E7F8EF;
  --color-success-border: #BDEDD3;

  /* Warning */
  --color-warning: #D99000;
  --color-warning-bg: #FFF4DA;
  --color-warning-border: #FFE1A6;

  /* Danger */
  --color-danger: #D92D5A;
  --color-danger-bg: #FFE9EF;
  --color-danger-border: #FFC8D5;

  /* Info */
  --color-info: #3F6DF6;
  --color-info-bg: #EAF0FF;
  --color-info-border: #C9D8FF;

  /* Active / In Visit */
  --color-active: #7C3AED;
  --color-active-bg: #F1EAFE;
  --color-active-border: #D8C8FA;

  /* Neutral */
  --color-neutral: #64748B;
  --color-neutral-bg: #F1F5F9;
  --color-neutral-border: #DDE6F2;
}
```

### Status mapping

| Status | Visual Meaning |
|---|---|
| Scheduled | info |
| Arrived | info |
| Checked-in | warning |
| In Visit | active |
| Completed | success |
| Needs Reschedule | warning |
| Cancelled | danger |
| No-show | danger |
| Postponed | neutral |
| Pending invoice | warning |
| Partially Paid | info |
| Paid | success |
| Cancelled invoice | danger |
| AI Processing | info |
| AI Completed | success |
| AI Failed | danger |
| AI Pending | neutral |
| Deferred feature | neutral/info, never danger |

## 5. Typography

Use a clean SaaS font. If the app already uses Inter, keep Inter.

```css
:root {
  --font-sans: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;

  --font-size-xs: 12px;
  --font-size-sm: 13px;
  --font-size-md: 14px;
  --font-size-base: 15px;
  --font-size-lg: 18px;
  --font-size-xl: 22px;
  --font-size-page-title: 32px;

  --line-height-tight: 1.2;
  --line-height-normal: 1.5;
  --line-height-relaxed: 1.65;

  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 650;
  --font-weight-bold: 750;
}
```

### Text usage

| Element | Size / Weight / Color |
|---|---|
| Page title | 32px, bold, dark navy |
| Page subtitle | 15px, regular, secondary text |
| Card title | 16–18px, semibold, dark navy |
| Table header | 12–13px, bold/uppercase, muted |
| Field label | 12–13px, semibold, muted |
| Field value | 14–15px, semibold or regular, main text |
| Button | 14px, semibold |
| Badge | 12–13px, semibold |

## 6. Spacing Scale

Use an 8px-based spacing system.

```css
:root {
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-7: 28px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
}
```

Usage:

- small icon/text gap: 8px
- input label to input: 8px
- button internal padding: 12px 18px
- card internal padding: 24px
- large modal padding: 28–32px
- page header to content: 28–32px
- table row padding: 18–20px
- form row gap: 16–20px
- section gap inside drawer: 24–28px

## 7. Border Radius

The app should have a soft rounded medical SaaS feel.

```css
:root {
  --radius-xs: 8px;
  --radius-sm: 10px;
  --radius-md: 14px;
  --radius-lg: 18px;
  --radius-xl: 22px;
  --radius-pill: 999px;
}
```

Usage:

- small badges: pill
- buttons: 12–14px
- inputs: 12–14px
- cards: 18–22px
- large panels: 22px
- modals/drawers: 22–24px
- sidebar active item: 12–14px
- icon squares: 12–16px

## 8. Shadows

Use soft shadows only. No harsh black shadows.

```css
:root {
  --shadow-xs: 0 4px 12px rgba(15, 31, 58, 0.04);
  --shadow-sm: 0 8px 24px rgba(15, 31, 58, 0.06);
  --shadow-card: 0 18px 45px rgba(15, 31, 58, 0.08);
  --shadow-modal: 0 24px 70px rgba(15, 31, 58, 0.18);
}
```

Usage:

- small hover cards: `--shadow-xs`
- dashboard cards: `--shadow-card`
- large content cards: `--shadow-card`
- modals/drawers: `--shadow-modal`
- buttons: no shadow or very soft primary glow only

## 9. Buttons

### Primary button

```css
.button-primary {
  background: var(--color-primary);
  color: var(--color-text-inverse);
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-md);
  padding: 12px 18px;
  font-weight: var(--font-weight-semibold);
}
```

Used for:

- Login
- Save
- Create
- Process Payment
- Upload
- Start Visit
- Complete Visit

### Secondary button

```css
.button-secondary {
  background: var(--color-surface);
  color: var(--color-text-main);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 12px 18px;
}
```

Used for:

- View Details
- Cancel modal
- Filter
- Print
- Open file

### Danger button

```css
.button-danger {
  background: var(--color-danger-bg);
  color: var(--color-danger);
  border: 1px solid var(--color-danger-border);
}
```

Used for:

- Cancel appointment
- Cancel invoice
- Delete attachment
- Deactivate user

### Disabled button

```css
.button-disabled {
  background: var(--color-surface-disabled);
  color: var(--color-text-disabled);
  border: 1px solid var(--color-border);
  cursor: not-allowed;
}
```

Used for:

- Export deferred
- Unsupported backend action
- Unauthorized role action

## 10. Inputs and Forms

```css
:root {
  --color-input-bg: #F8FAFD;
  --color-input-border: #DDE6F2;
}

.input {
  background: var(--color-input-bg);
  border: 1px solid var(--color-input-border);
  border-radius: var(--radius-md);
  color: var(--color-text-main);
  padding: 12px 14px;
  font-size: var(--font-size-md);
}

.input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(63, 109, 246, 0.12);
}
```

Used for:

- login form
- patient form
- appointment form
- billing/payment form
- settings form
- search inputs
- filters
- textarea notes

Rules:

- Inputs should be light gray-blue, not pure white if inside white card.
- Labels above inputs.
- Errors below input or near section.
- Do not use red borders unless validation failed.

## 11. Cards and Panels

### Standard card

```css
.card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-card);
  padding: var(--space-6);
}
```

Used for:

- dashboard stats
- appointment schedule
- patient list
- billing list
- settings sections
- doctor/staff profile sections
- active visit sections

### Muted internal panel

```css
.panel-muted {
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
}
```

Used for:

- patient detail blocks
- invoice information cards
- visit detail blocks
- attachment/AI result panels
- deferred messages
- empty states

## 12. Sidebar

```css
:root {
  --color-sidebar-bg: #FFFFFF;
  --color-sidebar-text: #52657F;
  --color-sidebar-active-bg: #EAF0FF;
  --color-sidebar-active-text: #3F6DF6;
}

.sidebar {
  width: var(--sidebar-width);
  background: var(--color-sidebar-bg);
  border-right: 1px solid var(--color-border);
}

.sidebar-item {
  color: var(--color-sidebar-text);
  border-radius: var(--radius-md);
  padding: 14px 16px;
}

.sidebar-item.active {
  background: var(--color-sidebar-active-bg);
  color: var(--color-sidebar-active-text);
}
```

Rules:

- Sidebar active state uses soft blue background.
- Active icon/text use primary blue.
- Inactive text is muted blue-gray.
- Logout button stays bottom.
- No random active colors per page.

## 13. Header / Topbar

```css
.topbar {
  height: var(--topbar-height);
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}
```

Used for:

- current user name
- role label
- theme toggle
- top spacing boundary

Rules:

- Topbar should stay clean.
- No large controls except theme/user info.
- Role label should be muted.

## 14. Tables

```css
.table-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-card);
  overflow: hidden;
}

.table th {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.table td {
  color: var(--color-text-main);
  font-size: var(--font-size-md);
  padding: 18px 20px;
  border-top: 1px solid var(--color-border-subtle);
}
```

Used for:

- patients list
- appointments list
- billing list
- users list
- doctors/staff list
- payments table
- visit history table

Rules:

- Tables live inside cards.
- Rows should have comfortable vertical spacing.
- Actions go right.
- Status badges should be compact.
- No dense spreadsheet look.

## 15. Badges

```css
.badge {
  border-radius: var(--radius-pill);
  padding: 6px 12px;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
}

.badge-success {
  background: var(--color-success-bg);
  color: var(--color-success);
}

.badge-warning {
  background: var(--color-warning-bg);
  color: var(--color-warning);
}

.badge-danger {
  background: var(--color-danger-bg);
  color: var(--color-danger);
}

.badge-info {
  background: var(--color-info-bg);
  color: var(--color-info);
}

.badge-active {
  background: var(--color-active-bg);
  color: var(--color-active);
}

.badge-neutral {
  background: var(--color-neutral-bg);
  color: var(--color-neutral);
}
```

Used for:

- appointment status
- invoice status
- AI status
- role labels
- deferred tags
- active visit

## 16. Modals

```css
.modal {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-modal);
}

.modal-header {
  padding: 28px 32px;
  border-bottom: 1px solid var(--color-border);
}

.modal-body {
  padding: 28px 32px;
}

.modal-footer {
  padding: 20px 32px;
  border-top: 1px solid var(--color-border);
}
```

Used for:

- appointment details
- invoice details
- payment processing
- create/edit patient
- create/edit user
- confirmation dialogs

Rules:

- Modal should not fill whole screen unless content needs it.
- Close button top-right.
- Footer actions bottom-right.
- Important destructive action uses danger style.

## 17. Drawers

Patient and staff profile drawers are large structured workspaces.

```css
.drawer {
  background: var(--color-surface);
  border-left: 1px solid var(--color-border);
  box-shadow: var(--shadow-modal);
}
```

Drawer usage:

- Patient profile
- Doctor/staff profile
- Detailed contextual records

Rules:

- Left summary column if drawer is large.
- Right content area with tabs/sections.
- Tabs stay inside drawer.
- Do not use fake rows.
- No raw IDs as main display.
- No raw timestamps.

## 18. Tabs

```css
.tabs {
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 4px;
}

.tab {
  border-radius: var(--radius-md);
  padding: 10px 16px;
  color: var(--color-text-secondary);
}

.tab.active {
  background: var(--color-primary);
  color: var(--color-text-inverse);
}
```

Used for:

- calendar view day/week/month
- patient profile tabs
- active visit workspace tabs
- doctor/staff profile tabs
- settings subsections

Rules:

- Active tab is blue.
- Inactive tabs are neutral.
- Do not add new tab styles per page.

## 19. Appointment Calendar Design

### Calendar shell

The appointment calendar should keep this structure:

- date navigation card at top
- search/filter card
- schedule card
- summary card

Rules:

- selected date defaults to local today
- date navigation uses same button style
- day/week/month tabs use standard tabs
- appointment slots use muted surface
- available slots are light neutral
- appointment cards are white/soft blue with status badge
- no hardcoded demo dates

### Appointment slot style

```css
.appointment-slot {
  background: var(--color-surface-muted);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
}
```

## 20. Patient Profile Design

Patient profile drawer should be a clear record workspace.

### Layout

Left column:

- initials/avatar
- name
- age/sex
- phone
- email
- blood group
- insurance
- emergency contact

Right/main column:

- General
- Medical Conditions History
- History / Visits
- Appointments
- X-rays / AI
- Billing

### Important naming rule

Use:

```text
Medical Conditions History
```

for backend field:

```text
medicalConditionsHistory
```

Use:

```text
History / Visits
```

for past visit records.

Do not show both `Medical Conditions History` and `Medical History` as duplicate patient fields.

## 21. Active Visit Design

Active Visit should be a doctor workspace, not just a notes form.

### Layout

- top patient visit summary card
- tabs/sections:
  - Visit Notes
  - Patient Profile
  - X-rays / Attachments
  - Billing / Invoice Handoff

### Top summary card contains

- patient name
- age/sex
- appointment time
- visit type
- visit status
- doctor
- started time formatted nicely
- medical conditions summary

No raw IDs as the main label.

Bad example:

```text
Doctor Attach1783278455434
Appointment 9
2026-07-05 19:07:35.621370
```

Good example:

```text
Demo Patient 01
Female · 32 years
Routine Checkup · Checked-in
Started Jul 6, 2026 at 10:00
```

## 22. Billing Design

Billing must use backend values.

### Invoice table

- invoice number/id
- patient
- doctor
- date
- total
- paid
- balance
- status
- actions

### Invoice detail modal

- patient information
- doctor
- visit
- invoice note
- total
- paid
- remaining
- payment history
- actions

### Actions

- Print Invoice: allowed if browser print only
- Export: disabled/deferred unless real backend export exists
- Edit: Staff only, if backend allows
- Cancel Invoice: Staff only, if backend allows
- Process Payment: Staff only

No fake PDF/text export.

## 23. Admin Users Design

Admin Users is required product functionality.

The UI should include:

- search/filter card
- users table
- create user button
- edit user modal
- role dropdown
- status toggle/select
- password reset/temporary password if backend supports it

Rules:

- No detailed permission matrix.
- No fake localStorage saves.
- No fake successful persistence.
- Roles are Admin, Staff, Doctor.

## 24. Roles Design

Roles page should be simple.

It should show a role reference:

- Admin: system/admin management
- Staff: operational workflow
- Doctor: clinical visit workflow

Do not create an editable detailed permissions matrix unless explicitly requested later.

## 25. Dark Mode

Dark mode should keep the same structure and semantic mapping.

```css
[data-theme="dark"] {
  --color-page-bg: #0F172A;
  --color-page-bg-soft: #111C33;

  --color-surface: #162238;
  --color-surface-muted: #1B2942;
  --color-surface-hover: #22324F;
  --color-surface-selected: #1E3A8A;

  --color-border-subtle: #26354F;
  --color-border: #2B3A55;
  --color-border-strong: #3A4B68;

  --color-text-main: #F8FAFC;
  --color-text-heading: #FFFFFF;
  --color-text-secondary: #CBD5E1;
  --color-text-muted: #94A3B8;
  --color-text-disabled: #64748B;

  --color-sidebar-bg: #111827;
  --color-sidebar-text: #CBD5E1;
  --color-sidebar-active-bg: #1E3A8A;
  --color-sidebar-active-text: #DCE7FF;

  --color-input-bg: #1B2942;
  --color-input-border: #334155;

  --shadow-card: 0 18px 45px rgba(0, 0, 0, 0.28);
  --shadow-modal: 0 24px 70px rgba(0, 0, 0, 0.36);
}
```

Rules:

- Dark mode is dark navy, not pure black.
- Cards must still be readable.
- Borders should be visible but soft.
- Primary blue remains the action color.

## 26. Responsive Rules

### Desktop

- sidebar visible
- topbar visible
- cards use grid layout
- drawers/modals can be wide
- tables can show full columns

### Tablet

- sidebar may collapse
- cards stack earlier
- tables can scroll horizontally
- no content should overflow viewport

### Mobile

- sidebar/drawer behavior must not break
- cards stack vertically
- tables become scrollable or compact
- modals fit screen width
- bottom actions stay accessible

## 27. Codex Design Rules

When fixing backend/frontend logic, preserve the DentalCare design system.

Do not:

- redesign the app
- change the sidebar structure
- change the global layout
- introduce new colors
- introduce new spacing systems
- introduce new button styles
- make pages denser
- make pages black-heavy
- use random gradients
- use harsh borders or shadows

Do:

- use existing cards, drawers, modals, tabs, buttons, tables, and badges
- add missing backend-supported fields inside existing components
- preserve spacing rhythm
- preserve soft medical SaaS look
- preserve semantic status colors
- preserve white/soft-gray/blue visual identity

## 28. Final Implementation Rule

Design changes are allowed only when needed to fit backend-supported UI into the existing design.

Logic fixes must not become redesign work.

Backend/frontend fixes must preserve:

- the existing sidebar
- the existing page structure
- the existing modal/drawer structure
- the existing cards/tables/tabs language
- the existing calm medical visual identity
