# Imaging cleanup scheduling contract

Pearlix keeps expired external X-ray artifacts and failed physical deletions in
the database until the configured storage provider confirms deletion. A
deployment must invoke the repository-owned cleanup command periodically:

```powershell
python manage.py purge_expired_imaging_artifacts --batch-size 100 --fail-on-deferred
```

Operational requirements:

- run with the same production settings, database, and storage credentials as
  the application;
- use a positive bounded batch size (the command clamps it to `1..1000`);
- schedule recurring invocations frequently enough for the configured external
  X-ray retention period and storage limits;
- alert on a nonzero exit when `--fail-on-deferred` is used, then allow the next
  invocation to retry;
- never log storage object names, credentials, patient data, or uploaded file
  metadata from scheduler wrappers.

The command is idempotent and its PostgreSQL row claims make overlapping
invocations safe. Each execution is bounded, retries retained deletion tasks,
and reports only aggregate attempted, completed, and deferred counts.

The repository intentionally does not choose a hosting-specific scheduler.
Deployment configuration must provision and monitor a suitable recurring
runner before release (`RG-09: DEPLOYMENT CONFIGURATION REQUIRED`).
