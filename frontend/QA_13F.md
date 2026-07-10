# Phase 13F QA - Appointments and Reschedule

## Scope

Phase 13F adds frontend appointment scheduling screens backed by the existing scheduling API. Backend behavior is unchanged.

## Routes

- Admin read-only: `/admin/appointments/day`, `/admin/appointments/week`, `/admin/appointments/month`, `/admin/appointments/list`, `/admin/appointments/needs-reschedule`
- Staff management: `/staff/appointments/day`, `/staff/appointments/week`, `/staff/appointments/month`, `/staff/appointments/list`, `/staff/appointments/needs-reschedule`, `/staff/appointments/:appointmentId/reschedule`
- Doctor read-only own schedule: `/doctor/appointments/day`, `/doctor/appointments/week`, `/doctor/appointments/list`, `/doctor/appointments/needs-reschedule`
- `/admin/appointments`, `/staff/appointments`, and `/doctor/appointments` redirect to the role day view.

## API Contract Checks

- List uses supported filters only: `page`, `doctor_id`, `patient_id`, `status`, `date`, `start_from`, `start_to`.
- Availability uses `GET /api/appointments/availability/` with `doctor_id`, `date`, and `duration_minutes`.
- Staff create/edit/reschedule uses appointment create/update payload fields only.
- Status changes use action endpoints: `check-in`, `cancel`, `no-show`.
- Doctor start visit uses `start-visit` only for checked-in appointments.
- The frontend does not send direct `status` PATCH payloads.

## Browser QA Checklist

- Login as Admin and verify appointment routes render read-only controls.
- Login as Staff and verify add, edit, status action confirmations, needs-reschedule list, availability slots, and reschedule route.
- Login as Doctor and verify only own appointment list is returned by backend permissions and checked-in rows show Start Visit.
- Confirm multiple `NEEDS_RESCHEDULE` appointments appear in the full-width Needs Reschedule list/table.
- Confirm table and calendar views scroll horizontally at tablet width without overlapping text.
- Confirm API validation, empty, loading, and permission errors render state components.

## Automated Checks

```bash
cd frontend
npm run typecheck
npm run test:run
npm run build
```

```bash
git diff --check
```
