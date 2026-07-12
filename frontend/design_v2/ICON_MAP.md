# Lucide Icon Map (Phase 14C lock)

Use Lucide React only, stroke width 1.75 (2 for 16 px destructive/action icons). Sizes: 16 inline/action, 18 input/metadata, 20 expanded navigation and normal buttons, 22 compact navigation, 24 KPI/empty-state. Inactive uses muted; active primary; disabled neutral at accessible contrast; destructive danger. Icon-only controls require visible-on-focus tooltip and `aria-label`.

| Destination/interaction | Lucide icon | Direction/label |
| --- | --- | --- |
| Dashboard, patients, appointments, active visit | `LayoutDashboard`, `UsersRound`, `CalendarDays`, `Stethoscope` | static meaning |
| Team, Users & Access, schedules, leave | `ContactRound`, `ShieldCheck`, `CalendarClock`, `CalendarOff` | static meaning |
| X-rays/AI, external X-rays, billing, audit, settings | `ScanLine`, `ImagePlus`, `ReceiptText`, `ScrollText`, `Settings` | static meaning |
| Add, edit, search, filter, overflow | `Plus`, `Pencil`, `Search`, `SlidersHorizontal`, `MoreHorizontal` | accessible action names |
| Detail/open, back, pagination, close | `ChevronRight`, `ArrowLeft`, `ChevronLeft/ChevronRight`, `X` | mirror only directional icons in RTL |
| theme/language/profile/logout | `Sun/Moon`, `Languages`, `CircleUserRound`, `LogOut` | segmented labels remain text |
| check-in, cancel, no-show, reschedule | `BadgeCheck`, `Ban`, `UserX`, `CalendarSync` | never status color only |
| upload, AI, print, payment, archive | `Upload`, `Sparkles`, `Printer`, `CreditCard`, `ArchiveRestore` | AI label/disclaimer required |

No emoji, mixed libraries, letter substitutes, or icon-only status meaning. Decorative dental art is separate from functional icons.
