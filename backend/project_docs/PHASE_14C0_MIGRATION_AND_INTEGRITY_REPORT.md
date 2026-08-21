# Phase 14C.0 Migration and Integrity Report

## Migration plan

`accounts.0005_doctorprofile_version_staffprofile_version_and_more` adds positive `version` fields (default `1`) to `User`, `DoctorProfile`, and `StaffProfile`. It is additive and does not delete, replace, or rewrite professional or operational records. Rollback removes only these version columns; it does not alter linked history.

Before and after deployment, run:

```powershell
cd backend
python manage.py check_profile_integrity --settings=config.settings.production
python manage.py migrate --plan --settings=config.settings.production
python manage.py migrate --settings=config.settings.production
python manage.py check_profile_integrity --strict --settings=config.settings.production
```

The command deterministically reports total users, linked Doctors/Staff, legacy unlinked professional accounts, dual profiles, role mismatches, and active Admin profiles. It exits non-zero in strict mode only for an inconsistent linkage. Legacy unlinked Doctor/Staff accounts are reported but preserved as `PROFILE_SETUP_REQUIRED`; they are intentionally not silently repaired or deleted.

## Referential constraints affecting transitions

Operational entities reference `User`, not the profile tables: `WorkingShift.employee` (CASCADE), `AvailabilityException.doctor/staff` (CASCADE), `Appointment.doctor` (PROTECT), and `Visit.doctor` (PROTECT). The transition service treats any of these rows as history and blocks an incompatible role transition. This preserves database references and the role assumptions in scheduling and visit validation.

No production data migration is required beyond the additive defaults. No destructive profile migration is included.

## Local development result

The additive migration applied successfully. Post-migration report: `users=12`, `linked_doctors=7`, `linked_staff=3`, `unlinked_professional_accounts=0`, `dual_profiles=0`, `role_mismatches=0`, and `active_admin_profiles=0`.

Phase 14C.0 verification recorded 40 focused Team/account-linkage tests, 414 full backend tests, and 52 frontend contract tests. No runtime Team UI exists yet; browser QA is pending, deployment remains paused, and Phase 14C is next.
