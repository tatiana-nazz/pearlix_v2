# Stage 9 Admin and supporting visual delta

Source: `7253ebd78cfd5ae23fd52c71c9dccda9eb6724f0`. Implementation: `d5fe795fb291bdd50b22626b25caaf70f3f4d5e6`.

| Comparison | Preserved contract | Noticeable structural change | Result |
| --- | --- | --- | --- |
| Clinic Settings read | Admin-only route, singleton settings, IANA timezone and current values. | A generic stacked form becomes a command header plus operational section rails and bounded control grids. | PASS |
| Clinic Settings edit/validation | Exact partial PATCH, dirty guard, validation, pending/success/failure and invalid duration/currency relationships. | Group boundaries and the sticky action surface make read/edit safety and invalid fields immediately scannable. | PASS |
| Audit register | Admin-only immutable newest-first pagination and URL filters. | A generic filter grid becomes a named read-only filter rail, count register, local table surface, and action/entity scan hierarchy. | PASS |
| Audit filtering/detail | Existing actor/action/entity/date filters, metadata redaction and back query. | Filter controls reflow independently from the register; read-only context remains explicit in list and detail. | PASS |
| Supporting states | Existing safe return destinations and no protected-route leakage. | Centered heading-first state cards replace small generic cards and make the safe action prominent. | PASS |
| Dark/responsive/RTL | Theme persistence, language direction, shell dimensions and no document overflow. | Headers, filter rail and form rails collapse through logical CSS; tables keep bounded local scrolling. | PASS |

Readability improves through explicit section identity, action/entity emphasis, contained long values, labels and visible errors. Action safety improves through retained sticky save/discard behavior and persistent read-only audit markers. The before/after captures are visibly distinct because page geometry changes from a generic card stack to command headers, a settings register, and an audit filter/register layout—not merely color or spacing changes.
