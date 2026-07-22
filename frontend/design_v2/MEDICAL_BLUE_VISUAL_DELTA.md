# Medical-blue visual delta — Stage 1

## Authority and preservation

The authority order remains: backend/API/RBAC and object authorization; accepted routes and workflows; accessibility, localization, RTL, responsive behavior, browser acceptance, and tests; shared shell/component contracts; then the external visual reference. No backend behavior, route, permission, payload, status transition, theme preference, language preference, or navigation destination changed.

Pearlix retains its accepted shell geometry: expanded sidebar **272 px**, compact sidebar **84 px**, desktop header **72 px**, and off-canvas navigation below the accepted tablet breakpoint. The external reference's 280/88/76 shell is intentionally rejected.

## Implemented tokens

| Family | Light | Dark |
| --- | --- | --- |
| Primary | `#3F6DF6`, hover `#315BE0`, active `#244BC5` | primary values retained for action contrast |
| Canvas | `#F4F7FC`, soft `#F7FAFF` | `#0F172A`, soft `#111C33` |
| Surfaces | `#FFFFFF`, muted `#F8FAFD`, hover `#F2F6FF`, selected `#EAF0FF`, disabled `#F1F5F9` | `#162238`, muted `#1B2942`, hover `#22324F`, selected `#1E3A8A`, disabled `#202E45` |
| Borders | subtle `#EDF2FA`, `#E3EAF5`, strong `#D4DEEC` | subtle `#26354F`, `#2B3A55`, strong `#3A4B68` |
| Text | heading `#0B1B34`, main `#0F1F3A`, secondary `#52657F`, muted `#8A9AB0`, disabled `#A8B4C5` | heading `#FFFFFF`, main `#F8FAFC`, secondary `#CBD5E1`, muted `#94A3B8`, disabled `#64748B` |
| Inputs | background `#F8FAFD`, border `#DDE6F2`, focus `#3F6DF6` | background `#1B2942`, border `#334155`, focus `#6D8DFF` |
| Shadows | card `0 18px 45px rgba(15, 31, 58, 0.08)`; modal `0 24px 70px rgba(15, 31, 58, 0.18)` | card `0 18px 45px rgba(8, 22, 45, 0.28)`; modal `0 24px 70px rgba(8, 22, 45, 0.36)` |

Teal remains the secondary clinical accent; medical blue is reserved for actions and selected states. Semantic colors remain meaning-only: success `#16A36A`, warning `#D99000`, danger `#D92D5A`, info `#3F6DF6`, and AI/active provenance `#7C3AED` with their existing text/background/border pairs.

## Shared foundation decisions

- Inter and the Arabic font/line-height architecture are retained. No global size increase was introduced.
- The established 4/8-compatible spacing scale and 44 px controls remain intact.
- Shared radii are now 12 px controls, 14 px small surfaces, 18 px cards, and 22 px dialogs.
- Buttons have medical-blue primary, restrained secondary, semantic soft-danger, active, disabled, and focus-visible states.
- Inputs, selects, and textareas use tokenized input surfaces and a 3 px focus-visible ring. Legacy form selectors inherit the same focus treatment.
- Cards, table shells, state panels, selected tabs, icon buttons, overlays, pagination controls, and status badges consume shared tokens. Loading uses a restrained opacity pulse rather than a gradient.
- Dark mode remains navy-surfaced with navy-tinted rather than black shadows.

## Accessibility, RTL, and responsive safeguards

Focus remains visible without color-only state. Status badges retain icon plus text semantics. Disabled controls retain readable tokenized contrast. Arabic font, line-height, logical properties, directional icons, and bidi-isolation utilities remain unchanged. Existing 272/84/72 geometry, 1023 px off-canvas behavior, scroll containment, and Phase 14F overflow protections are preserved.

## Reference adjustments and deferred work

The source reference informed palette, surface, radius, depth, and component-state direction. Its shell dimensions, any page-layout rearrangement, and any functionality beyond existing contracts were rejected. Page-specific dashboard, appointment, patient, Team, billing, table, and form layout alignment is deferred to later stages; this stage only removes conflicting shared visual values where required.

Recommended next stages: page-level composition alignment; representative workflow visual regression; then a controlled final cross-role acceptance pass.
