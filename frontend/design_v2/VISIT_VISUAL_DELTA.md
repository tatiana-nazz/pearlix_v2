# Visit visual delta - Stage 7

Source: `post-14f-medical-blue-billing` at `7e048bfc11d6fef6aeabe393c4a1c7a43e945885`. Implementation: `1cc67e199473d662859c21c76127093f6ab555b7`.

| Pair | Structural visual change | Result |
| --- | --- | --- |
| Doctor Active Visit | The visit identity/context becomes a distinct clinical header with a framed workspace and separated action band. | PASS |
| Clinical Notes | Five fields form a responsive grid with the clinical narrative field spanning the primary reading width; save remains locally grouped. | PASS |
| History | History is contained in the workspace frame with a bounded table surface and preserved current-visit exclusion. | PASS |
| Appointment Info | Appointment facts receive a dedicated card hierarchy and the billing boundary remains below that clinical context. | PASS |
| Embedded X-rays & AI | The tab inherits the framed clinical workspace while its existing protected interaction boundary is preserved. | PASS |
| Complete Visit confirmation | Patient identity and dirty-note context are grouped before the explicitly ordered Keep active / Complete actions. | PASS |
| Staff read-only | The same clinical hierarchy communicates readonly status without Doctor mutation controls. | PASS |
| Admin read-only | The readonly clinical view remains distinct from X-ray, Billing, note, and completion mutations. | PASS |
| Arabic/RTL | Logical layout, bidi-isolated clinical values, tab navigation, and actions remain usable at 768 px. | PASS |
| No-active-visit state | The empty clinical route uses the aligned empty-state surface and the day-appointments recovery action. | PASS |

The delta is structural rather than a minor style-only substitution: clinical field geometry, workspace framing, identity hierarchy, dialog summary, action grouping, and responsive stacking all change while functional contracts remain unchanged. The deterministic seed supports all recorded pairs; no pair is marked PASS solely for a token or cosmetic difference.
