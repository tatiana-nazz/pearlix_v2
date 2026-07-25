# Phase 14D.3A Appointments Contract and Test-Coverage Closure

Starting commit: `637713c06333a5ff2101897f7f1b752892e7ae3d`.

## Closure scope

This closure corrects the remaining appointment-create identity contract. Staff now select an active patient from a debounced, server-backed `/patients/` search rather than entering a database identifier. The selected identity is represented in the payload only as `patient_id`; names, phones, and ages are display data only.

The picker waits for two meaningful characters, debounces searches, sends `search` with `is_archived=false`, and never requests an unfiltered patient list. The backend's page size remains the bounded twenty-result patient page. It presents full name, phone, and age; it does not render a primary-key value, national ID, email, or other private patient information.

## Workflow and access findings

- Staff is the only appointment-mutation role. Admin and Doctor appointment workspaces remain read-only.
- The single Staff New Appointment modal is the canonical create flow, so the corrected form covers all appointment creation entry points.
- The serializer continues to reject an archived `patient_id`, including a stale or direct client payload. Backend tests cover that boundary and the active, bounded patient-search response.
- Week and Month now group appointments with the returned clinic timezone and provide a keyboard-accessible day activation that opens the role-scoped Day route.
- Needs Reschedule remains a Staff route backed by the existing availability-picker and update workflow; no status is patched by the generic appointment form.

## Accessibility, localization, and presentation

The shared v2 combobox exposes a labelled combobox/listbox relationship, expanded and active-descendant state, ArrowUp/ArrowDown, Enter, Escape, pointer selection, visible focus, retryable errors, loading and empty status, selected-value status, and an explicit clear control. New picker copy is localized for English and Arabic and uses logical token CSS for RTL, themes, and responsive wrapping.

Browser QA was not executed. `frontend/QA_14D3_APPOINTMENTS_WORKSPACE.md` remains the required manual matrix.

## Automated verification

- Patient-picker tests cover the minimum query gate, loading/empty/error states, retry affordance, stale-result protection, keyboard and pointer selection, clear, selected-state preservation after a backend error, and exact payload mapping.
- Appointment calendar tests cover clinic-timezone grouping and Week/Month day activation.
- Appointment-table tests cover Admin and Doctor read-only action boundaries.
- Backend focused tests cover bounded active patient search and archived-patient appointment rejection.

Final verification: 104 frontend tests in 38 files, 62 focused backend patient/scheduling tests, and 420 complete backend tests passed. Typecheck, production build, Django system check, migration-drift check, and documentation-consistency check also passed. The production build retains the pre-existing advisory for a JavaScript chunk above 500 kB.

No external API shape, permission model, migration, or database schema changes were made in this closure.
