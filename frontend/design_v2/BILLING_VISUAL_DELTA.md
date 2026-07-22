# Billing visual delta — Stage 6

Source: `post-14f-medical-blue-team-management` at `c46c3b000873593623fdb588dab09ff52523dabe`. Implementation: `97566c0e3f79ada7ae9fe004025d2451b785779f`.

| Pair | Composition change | Result |
| --- | --- | --- |
| Staff billing workspace | Command header, contained register framing, stronger financial scan columns, and grouped pagination replace the flat list composition. | PASS |
| Invoice details | Financial values now form a dedicated three-part settlement band; context and payment history remain separate readable regions. | PASS |
| Billing handoff detail | The existing operational detail card inherits the record hierarchy and protected action boundary. | PASS |
| Payment dialog | Shared modal keeps the remaining-balance statement adjacent to controlled amount and currency fields. | PASS |
| Printable invoice | Clinic identity, invoice identity, and financial settlement are separated into print-safe regions. | PASS |
| Admin read-only billing | The same register hierarchy makes read-only visibility clear while mutation actions remain absent. | PASS |
| Compact responsive billing | Tables use bounded local scroll while record and settlement surfaces reflow to one column. | PASS |

The changes are structural—workspace framing, register geometry, financial hierarchy, action grouping, and print composition—not cosmetic token substitutions. Functional contracts, payloads, routes, permissions, and backend financial rules are unchanged.
