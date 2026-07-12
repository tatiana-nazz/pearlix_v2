# Tokens v2

The semantic authority is `src/styles/v2/colors.css`. Existing `--v2-*` and legacy aliases resolve through these values; feature CSS must use aliases rather than repeating color literals.

| Family | Light | Dark | Required use |
| --- | --- | --- | --- |
| primary | `#3F6DF6` / hover `#315BE0` | light authority retained | primary controls, active emphasis, focus source |
| secondary | `#4AA3F5` | light authority retained | secondary accent only; never a primary control |
| page | `#F4F7FC` / soft `#F7FAFF` | `#0F172A` / soft `#111C33` | application canvas |
| surface | `#FFFFFF` / muted `#F8FAFD` / hover `#F2F6FF` | `#162238` / `#1B2942` / `#22324F` | cards, inputs, hover surfaces |
| border | `#E3EAF5` / strong `#D4DEEC` | `#2B3A55` / `#3A4B68` | separators and controls |
| text | `#0F1F3A`, secondary `#52657F`, muted `#8A9AB0` | `#F8FAFC`, `#CBD5E1`, `#94A3B8` | hierarchy and metadata |
| sidebar | `#FFFFFF`, active `#EAF0FF` | `#111827`, active `#1E3A8A` | navigation surfaces |
| input | `#F8FAFD`, border `#DDE6F2`, focus `#3F6DF6` | `#1B2942`, `#334155`, `#6D8DFF` | fields and focus |
| success | `#16A36A`, bg `#E7F8EF`, border `#BDEDD3` | semantic light value retained | success status/icon tile |
| warning | `#D99000`, bg `#FFF4DA`, border `#FFE1A6` | semantic light value retained | attention status/icon tile |
| danger | `#D92D5A`, bg `#FFE9EF`, border `#FFC8D5` | semantic light value retained | error/billing follow-up tile |
| info | `#3F6DF6`, bg `#EAF0FF`, border `#C9D8FF` | semantic light value retained | informational tile |
| active | `#7C3AED`, bg `#F1EAFE`, border `#D8C8FA` | semantic light value retained | AI-specific provenance |

Card shadow is `0 18px 45px rgba(15, 31, 58, 0.08)` light and `0 18px 45px rgba(0, 0, 0, 0.28)` dark. Soft shadow is `0 10px 30px rgba(15, 31, 58, 0.06)` light and `0 10px 30px rgba(0, 0, 0, 0.22)` dark. Focus is a 3 px tokenized primary ring plus 1 px border and never color alone.

Spacing is `4,8,12,16,20,24,32,40,48,64`; radii are 8 controls, 12 small surfaces, 16 cards, 20 dialogs; standard controls/buttons are 44 px (36 px compact), tablet targets at least 40 px.

## Arabic typography and bidi

Latin UI stack is `Inter, ui-sans-serif, system-ui, sans-serif`; Arabic UI stack is `"Noto Sans Arabic", Tahoma, Arial, sans-serif` (font delivery is not a Phase 14D requirement). Arabic body/label/heading line heights are 1.75/1.55/1.35 and weights 400/500/600–700; Latin remains 14/22 body, 13/18 label, 32/40 page title. Mixed-script names wrap at word boundaries. Email, phone, national ID, invoice number, date/time, currency amount, and code values use `dir="ltr"` plus `unicode-bidi:isolate`; Arabic narrative uses RTL. Use logical start/end alignment and padding; never middle-truncate identifiers.
