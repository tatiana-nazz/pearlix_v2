# Phase 13E Patients QA

## Environment

Backend:

```bash
cd backend
python manage.py seed_dev_qa_users --password "PearlixDev123!" --include-must-change-user
python manage.py runserver
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Use `frontend/.env.local`:

```bash
VITE_API_BASE_URL=http://127.0.0.1:8000/api
```

## QA Accounts

- Admin: `admin.qa@pearlix.local`
- Staff: `staff.qa@pearlix.local`
- Doctor: `doctor.qa@pearlix.local`
- Password is the local value passed to `seed_dev_qa_users`.

## Patient List Checks

- `/admin/patients` loads active patients and has no Add Patient action.
- `/staff/patients` loads active patients and shows Add Patient.
- `/doctor/patients` loads active non-archived patients.
- Search by name, phone number, email, or ID preserves URL state.
- Staff/Admin archive filter switches between active and archived records.
- Doctor sees workflow filters and no archived filter.
- Pagination preserves search and filter state.
- Empty responses render `No patients found for this filter.`

## Role Action Checks

- Admin rows show View only.
- Staff rows show View, Edit, and Archive or Unarchive.
- Doctor rows show View and Edit, with no Archive or Unarchive.
- Row action clicks do not open the row unintentionally.
- No Delete Patient action appears anywhere.

## Create/Edit/Archive Checks

- Staff can create a temporary QA patient from `/staff/patients/new`.
- Successful create navigates to the patient profile.
- Staff can edit supported patient fields.
- Doctor can edit allowed profile fields on active patients.
- Backend field errors stay visible and preserve form values.
- Staff archive uses `Archive Patient` wording and keeps the record stored.
- `ARCHIVE_BLOCKED` errors stay visible and do not remove the patient.
- Staff can view archived records and unarchive them.

## Profile Tab Checks

- Overview shows real demographics and formatted metadata.
- Medical Summary shows profile-level medical summary and general notes.
- Visits shows a lightweight real-data history summary.
- Appointments shows a lightweight real-data appointment summary.
- X-rays & AI shows saved X-ray and AI result summaries only.
- Billing/Handoff is visible to Staff/Admin as Phase 13I placeholder content.
- Doctor does not see invoice/payment/global billing UI.

## Responsive Targets

- 1440px desktop: full table and profile cards remain readable.
- 1280px laptop: filters and table remain readable.
- 1024px landscape tablet: table may horizontally scroll.
- 768px tablet: compact sidebar remains usable and forms stack cleanly.

## Tests Executed

- `npm run typecheck`
- `npm run test:run`
- `npm run build`
- `git diff --check`

## Browser Checks Completed

Not executed in this phase.

## Browser Checks Still Pending

- Admin patient list/profile read-only pass.
- Staff create/edit/archive/unarchive pass with a temporary QA patient.
- Doctor active patient list/profile/edit pass.
- Responsive browser checks at 1440px, 1280px, 1024px, and 768px.
