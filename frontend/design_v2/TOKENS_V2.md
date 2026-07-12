# Tokens v2

| Family | Light | Dark | Required use |
| --- | --- | --- | --- |
| canvas | `#F3F7FA` | `#101B27` | application canvas |
| surface | `#FFFFFF` | `#172534` | cards, topbar, inputs |
| surface-subtle | `#EAF3F7` | `#203444` | toolbar/header/selected quiet fill |
| border | `#D6E3EA` | `#365064` | 1 px separators/controls |
| text | `#102A43` | `#E7F0F6` | body/headings, ≥4.5:1 |
| muted | `#587087` | `#A7BCCB` | supporting metadata |
| primary | `#087A9E` | `#38B9D6` | primary action/active |
| primary-strong | `#075D79` | `#7BD8EA` | pressed/link emphasis |
| teal | `#087F7A` | `#44C9B6` | secondary clinical accent |
| info | `#2563EB` | `#79A7FF` | informational state |
| success | `#168A4A` | `#59C987` | success text/icon plus label |
| warning | `#B86100` | `#F3B655` | needs attention plus label |
| danger | `#C73737` | `#F28383` | destructive/error plus label |
| neutral | `#526779` | `#B2C3CE` | neutral state |
| AI | `#6952C7` | `#B5A5FF` | AI-specific provenance only |

Spacing is `4,8,12,16,20,24,32,40,48,64`; radii are 8 controls, 12 small surfaces, 16 cards, 20 dialogs; standard controls/buttons are 44 px (36 px compact), tablet targets at least 40 px. Focus is a 3 px primary ring plus 1 px border and never color alone. Major elevation: `0 8px 24px rgba(16,42,67,.10)` light / `0 8px 24px rgba(0,0,0,.24)` dark; routine rows use no shadow.

Status component exposes `aria-label="Status: {text}"`, icon, text, and token; disabled controls preserve 44 px geometry, 50% text contrast only when still legible, and `aria-disabled` where appropriate.

## Arabic typography and bidi

Latin UI stack is `Inter, ui-sans-serif, system-ui, sans-serif`; Arabic UI stack is `"Noto Sans Arabic", Tahoma, Arial, sans-serif` (font delivery is not a Phase 14B requirement). Arabic body/label/heading line heights are 1.75/1.55/1.35 and weights 400/500/600–700; Latin remains 14/22 body, 13/18 label, 32/40 page title. Mixed-script names wrap at word boundaries. Email, phone, national ID, invoice number, date/time, currency amount, and code values use `dir="ltr"` plus `unicode-bidi:isolate`; Arabic narrative uses RTL. Use logical start/end alignment and padding; never middle-truncate identifiers. Cards clamp long names after two lines, while tables preserve copyable full text via title/accessible label.
