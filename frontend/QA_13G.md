# Phase 13G QA - Active Visits And Clinical Notes

## Scope

Phase 13G integrates existing visit APIs into the React application. It does not add X-ray/AI or billing user interfaces.

## Automated Checks

Run from `frontend`:

```bash
npm run typecheck
npm run test:run
npm run build
```

Focused coverage validates the own-Doctor clinical-note/completion permission boundary and supported clinical note fields. Backend workflow tests remain the authority for appointment-to-visit, role, and completion behavior.

## Browser QA - Pending Execution

Browser QA remains pending execution with the seeded local QA accounts. Credentials are available; the pending item is live browser execution, not account setup.

1. Run the backend and frontend locally, then sign in as the seeded Staff and Doctor accounts.
2. As Staff, create or find an upcoming appointment and check it in. Confirm Staff cannot start the visit from the UI.
3. As the owning Doctor, open `/doctor/appointments/day`, start the checked-in appointment, and confirm navigation to `/doctor/visits/:visitId`.
4. Confirm `/doctor/visits/active` shows the same active visit. Enter text in all five clinical note fields and save.
5. Refresh the visit detail and confirm saved notes remain present.
6. Change a note without saving, choose **Complete Visit**, and confirm **Save & Complete** saves the notes before completion.
7. Confirm the completed visit remains visible, its linked appointment is completed, and the owning Doctor can still save notes.
8. Sign in as Admin and Staff. Open the same visit via patient history and direct role route. Confirm notes are visible but no edit or complete controls are present.
9. Sign in as a different Doctor. Confirm the clinical history can be read where backend access permits, but edit and completion controls are absent.
10. Confirm a Doctor without an active visit sees the empty state at `/doctor/visits/active` and can return to appointments.
11. Simulate an API failure during note save and during completion. Confirm typed notes remain present and a completion failure does not discard notes that were already saved.

## Acceptance Notes

- The frontend sends only the five accepted clinical-note fields to `PATCH /api/visits/{id}/clinical-notes/`.
- The completion workflow uses `POST /api/visits/{id}/complete/` only after a successful dirty-note save.
- Query invalidation is limited to visit, active visit, appointment, patient visit history, and doctor dashboard contexts.
- Historical Phase 13G note: protected media, X-ray upload/AI, and billing handoff actions were deferred to Phases 13H/13I and are now implemented.
