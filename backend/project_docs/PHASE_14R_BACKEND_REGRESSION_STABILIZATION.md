# Phase 14R Backend Regression Stabilization

## Starting regression state

The authorized starting commit was `0d67d4e`. The baseline backend suite had 386 passing and 28 failing tests. The failures were already present on `origin/main`; Phase 14D.1 did not introduce them.

## Original failing tests and root-cause clusters

- Stale scheduling clock: `test_staff_can_create_read_update_and_transition_appointment`, `test_omitted_duration_uses_clinic_default_and_frontend_end_datetime_is_ignored`, `test_working_hours_and_unavailable_exception_are_enforced`, all three `test_capacity_counts_active_statuses` cases, all four `test_capacity_and_doctor_conflict_ignore_inactive_statuses` cases, `test_doctor_conflict_rules`, `test_staff_update_revalidates_rules_and_rejects_direct_status_change`, `test_update_revalidates_capacity_and_locked_statuses_are_not_editable`, `test_staff_can_reschedule_needs_reschedule_appointment_to_valid_slot`, `test_needs_reschedule_reschedule_validates_slot_rules`, and `test_needs_reschedule_reschedule_rejects_capacity_and_roles`.
- Stale future leave/shift fixtures: `test_doctor_unavailable_exception_marks_future_overlapping_appointments_needs_reschedule`, `test_cancel_doctor_leave_restores_still_unrescheduled_appointment`, `test_cancelled_leave_no_longer_blocks_scheduling`, `test_cancel_leave_after_staff_reschedule_does_not_move_appointment_back`, `test_cancel_leave_keeps_needs_reschedule_when_another_active_leave_blocks_slot`, `test_availability_exception_update_marks_newly_overlapping_without_auto_restore`, and `test_doctor_shift_reduction_requires_confirmation_and_marks_only_affected`.
- Cross-feature callers sharing the stale appointment date: `test_important_actions_create_safe_audit_logs`, `test_doctor_helper_filters_remain_available`, `test_frontend_controlled_fields_are_rejected_or_overridden`, `test_wf_008_billing_handoff_to_invoice_payment_workflow`, and `test_wf_004_clinical_permission_workflow`.

All failures originated in test scenarios whose fixed July 2026 appointments had crossed into the past, while the approved appointment contract correctly rejects past appointment creation and does not mark past appointments for rescheduling.

## Runtime corrections

- Capacity now counts active appointments whose intervals overlap the candidate interval, not just appointments with an identical start time.
- Appointment creation locks the clinic settings row before interval validation; updates use the same lock order and lock the appointment row before applying the update.
- Scheduling uses the validated clinic IANA timezone for working-day evaluation, shift impact detection, and availability construction.
- Availability excludes past same-day clinic-local slots.
- `AVAILABLE_OVERRIDE` supplies usable availability outside recurring shifts; overlapping `UNAVAILABLE` exceptions take precedence.
- Availability validation distinguishes invalid `date` and `duration_minutes` inputs.
- Clinic settings reject invalid IANA timezone identifiers with a field-specific error.

## Test-contract corrections

No existing assertion expectations changed. The shared pytest fixture now uses a deterministic UTC clock corresponding to 2026-07-15 12:00 in the clinic timezone, preserving the intended future/past relationship of the existing fixed-date scheduling scenarios.

## Database and API changes

No migrations or database schema changes. No external endpoint shape or error-code changes. Existing `CAPACITY_FULL`, `DOCTOR_UNAVAILABLE`, `OUTSIDE_WORKING_HOURS`, and `VALIDATION_ERROR` contracts are preserved.

## Concurrency and timezone protections

Booking validation uses a stable clinic-settings lock followed by appointment locking for updates, with interval-overlap validation performed inside the transaction. Datetimes remain timezone-aware; business availability is evaluated with `ClinicSettings.timezone` through `zoneinfo`.

## Added regression coverage

`tests/scheduling/test_regression_stabilization.py` covers overlapping capacity, available-override behavior and unavailable precedence, clinic-timezone slot construction with a differing process timezone, same-day past-slot exclusion, invalid timezone rejection, and field-specific invalid date/duration errors.

## Final verification

- Backend complete suite: 418 passed, 0 failed.
- Frontend suite: 84 passed in 34 files.
- Typecheck, production build, Django system check, migration-drift check, documentation consistency, and `git diff --check` passed.

## Remaining limitations and QA

Browser/manual QA was not executed. The known product limitations remain AI mock-only operation, email forgot-password, manual billing, and the remaining Phase 14D dashboard, appointment, and patient UI redesign work.
