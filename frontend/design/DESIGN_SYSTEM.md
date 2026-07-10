# Pearlix Design System

Phase 13B.1 defines the frontend visual contract for Pearlix. This is the source of truth for future UI work unless a later design phase explicitly replaces it.

## Product Character

Pearlix is a professional dental clinic management system. The interface must feel like serious medical SaaS: calm, trustworthy, spacious, readable, and operationally clear.

The product must not feel childish, flashy, crowded, decorative, or like a generic admin template. Avoid novelty visuals, heavy gradients, dense dashboards, excessive shadows, decorative blobs, and noisy color use.

## Color Tokens

Use a white and soft-gray base with calm blue and teal accents.

| Token | Value | Usage |
| --- | --- | --- |
| `--color-bg` | `#f5f8fb` | App background |
| `--color-surface` | `#ffffff` | Cards, panels, sidebar, topbar |
| `--color-surface-muted` | `#eef6f8` | Active nav, subtle panel fills |
| `--color-border` | `#dbe7ed` | Card, input, table, layout borders |
| `--color-text` | `#172733` | Primary text |
| `--color-muted` | `#5f7180` | Secondary text |
| `--color-primary` | `#116d8f` | Primary buttons, selected states |
| `--color-primary-strong` | `#075a79` | Hover/pressed primary |
| `--color-accent` | `#1a9a9a` | Eyebrows, small highlights, status accents |
| `--color-danger` | `#b42318` | Destructive/error text |
| `--color-warning` | `#b7791f` | Needs attention states |
| `--color-success` | `#178563` | Completed/paid/available states |

Status colors must be restrained. A badge may use a light tinted background and darker text, but whole pages should never be dominated by status colors.

## Typography

Use a system sans stack. Do not scale fonts with viewport width.

| Token | Size | Usage |
| --- | --- | --- |
| `--font-size-xs` | `0.75rem` | Badges, metadata |
| `--font-size-sm` | `0.875rem` | Secondary labels |
| `--font-size-md` | `1rem` | Body and controls |
| `--font-size-lg` | `1.125rem` | Card headings |
| `--font-size-xl` | `1.375rem` | Page headings |
| `--font-size-2xl` | `1.75rem` | Major dashboard headings |

Line height should be comfortable: 1.2 for headings, 1.5-1.6 for body text. Letter spacing must be `0` except uppercase eyebrows, which may use normal browser spacing but must not be negative.

## Spacing Scale

Use an 8px-based spacing scale:

- `--space-1`: 4px
- `--space-2`: 8px
- `--space-3`: 12px
- `--space-4`: 16px
- `--space-5`: 20px
- `--space-6`: 24px
- `--space-7`: 28px
- `--space-8`: 32px
- `--space-10`: 40px
- `--space-12`: 48px

Default page padding is 32px on desktop XL, 28px on laptop, 24px on small laptop, and 16-20px on tablet.

## Radius Scale

Cards and controls use modest radius. Do not use pill-shaped or overly rounded card containers.

- `--radius-sm`: 4px
- `--radius-md`: 6px
- `--radius`: 8px
- `--radius-lg`: 10px, reserved for large modal/shell surfaces only

## Shadow Rules

Shadows are minimal and functional.

- Use subtle shadows only for elevated cards, dropdowns, and modals.
- Do not stack multiple shadows.
- Do not use glow effects.
- Prefer borders over shadows for routine layout separation.

## Layout Rules

- Left sidebar is the persistent workspace anchor.
- Topbar contains current user/workspace context and global actions.
- Main content uses large readable cards and clear section spacing.
- Tables and calendars may horizontally scroll on tablet rather than compressing text.
- UI cards must not be nested inside other decorative cards.
- Page sections should be unframed layouts or single-purpose panels, not marketing-style card mosaics.

## Role Workspace Rules

Admin workspace:

- Feels supervisory and configuration-focused.
- Prominent navigation for users, clinic settings, doctors, schedules, leave, audit.
- Operational records are read-only unless backend explicitly allows mutation.

Staff workspace:

- Feels scheduling and billing focused.
- Prominent navigation for patients, appointments, Needs Reschedule, handoffs, invoices, payments.
- Doctor unavailable blocks must be easy to discover in scheduling flows.

Doctor workspace:

- Feels clinical and appointment focused.
- Prominent navigation for active visit, patients, clinical history, X-rays/AI, own schedule/leave.
- No invoice/payment/global billing navigation.

## Badges

Badges are required for operational statuses. Use short text and a quiet tint:

- Appointment: `UPCOMING`, `CHECKED_IN`, `ACTIVE`, `COMPLETED`, `CANCELLED`, `NO_SHOW`, `NEEDS_RESCHEDULE`
- Visit: `ACTIVE`, `COMPLETED`
- Invoice: `UNPAID`, `PARTIALLY_PAID`, `PAID`, `CANCELLED`
- Handoff: `PENDING`, `CONVERTED_TO_INVOICE`, `DISMISSED`
- AI: `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`

`NEEDS_RESCHEDULE`, conflicts, and validation warnings should use warning styling, not danger styling unless data is lost or action failed.
