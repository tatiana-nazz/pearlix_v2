# Dev QA Accounts

## Purpose

These accounts are for local development and browser QA only. They are not production seed data and must not be used for public deployments.

## Safety

- The command is DEBUG-only by default.
- Never use the fallback password in production.
- Never commit `.env` files or secrets.
- Never expose these accounts on a public deployment.
- Passwords are set with Django password hashing and are not printed unless `--show-passwords` is explicitly used in DEBUG mode.

## Default QA Users

Admin:

- `admin.qa@pearlix.local`

Staff:

- `staff.qa@pearlix.local`

Doctor:

- `doctor.qa@pearlix.local`

Optional must-change-password Doctor:

- `doctor.mustchange@pearlix.local`

## Command Examples

```bash
cd backend
python manage.py seed_dev_qa_users --password "PearlixDev123!"
python manage.py seed_dev_qa_users --password "PearlixDev123!" --reset-passwords
python manage.py seed_dev_qa_users --password "PearlixDev123!" --include-must-change-user
python manage.py seed_dev_qa_users --password "PearlixDev123!" --include-must-change-user --show-passwords
```

## Environment Variable Example

PowerShell:

```powershell
$env:PEARLIX_DEV_QA_PASSWORD="PearlixDev123!"
python manage.py seed_dev_qa_users --reset-passwords
```

## Browser QA Expectations

Admin:

- Login routes to `/admin/dashboard`.

Staff:

- Login routes to `/staff/dashboard`.

Doctor:

- Login routes to `/doctor/dashboard`.

Must-change-password Doctor:

- Login routes to `/change-password`.
- Protected workspace pages remain blocked until the password is changed.

## Cleanup

To remove local QA users safely, use the Django shell in a known local development database:

```bash
cd backend
python manage.py shell
```

```python
from apps.accounts.models import User

User.objects.filter(email__in=[
    "admin.qa@pearlix.local",
    "staff.qa@pearlix.local",
    "doctor.qa@pearlix.local",
    "doctor.mustchange@pearlix.local",
]).delete()
```

Do not add automatic deletion to QA workflows unless the target database is known to be local and disposable.
