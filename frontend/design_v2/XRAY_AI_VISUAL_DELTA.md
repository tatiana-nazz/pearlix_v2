# X-ray and AI visual delta — Stage 8

Source: `a9cdd031f6f2a4b220993c57331c1bef627763cb`. Implementation: `5cdd84c30f7668b9710832f411230c7560d33d0e`.

| Comparison | Structural delta | Result |
| --- | --- | --- |
| Doctor workspace / gallery | Six-column table becomes a three-card responsive clinical gallery with selected-image affordance, patient/visit hierarchy, and separate AI lifecycle. | PASS |
| Protected viewer | The image is now a dominant contained canvas with protected-access marker, a fact grid, and a distinct AI rail. | PASS |
| Upload | File choice is a bounded guidance surface with a selected-file summary and contained preview. | PASS |
| AI result / overlay | Lifecycle, model output, finding, explicit disclaimer, and overlay toggle are separated into visible groups. | PASS |
| Staff/Admin | The same protected viewer communicates available evidence without adding saved-X-ray mutation controls; external Admin routing remains existing-only. | PASS |
| Responsive / RTL | Gallery collapses to one column, facts and actions stack, and logical CSS properties preserve RTL alignment. | PASS |
| Empty/error and unavailable states | Existing semantic StatePanel paths are retained inside the new canvas/gallery frame rather than hidden. | PASS |

The before/after pair is clearly noticeable because the primary content geometry changed from tables and generic cards to an image-centric workspace, gallery cards, fact grid, and dedicated AI rail. Security, clinical wording, object-level authorization, protected-media access, and backend status values remain unchanged.
