# Phase 13H QA - X-rays, Protected Media, And AI

## Scope

Phase 13H integrates saved X-rays, AI results, protected media, and the external X-ray workspace with existing backend APIs. Backend runtime code and migrations are unchanged.

## Routes And Roles

- Saved X-rays: Admin, Staff, and Doctor can list/read `/[role]/xrays` and details. Only Doctors upload patient/own-visit X-rays and run saved-X-ray AI.
- External workspace: Admin and Doctor can list, upload, read, run AI, and discard. Staff has no route. Only the owning Doctor can attach a temporary external case to a patient; Admin attach is hidden.
- Terminal external statuses hide temporary-only actions.

## Protected Media

- The authenticated API client fetches `file/` and `ai-overlay/` endpoints as Blobs.
- Components render temporary `URL.createObjectURL` values only and revoke them on endpoint change or unmount.
- Blobs and object URLs are not persisted in local storage, Zustand, or query data. No public media URL is used.

## Automated Checks

Run from `frontend`:

```bash
npm run typecheck
npm run test:run
npm run build
```

Run from `backend`:

```bash
python -m pytest tests/xrays -q
python -m pytest tests/visits -q
python -m pytest tests/patients -q
python -m pytest tests/workflows -q
python -m pytest tests/security -q
python -m pytest -q
python manage.py check
python manage.py makemigrations --check --dry-run
```

Phase 13H verification results:

- Frontend: `npm run typecheck` passed; `npm run test:run` passed with 21 files and 47 tests; `npm run build` passed.
- Targeted backend: X-rays 74 passed, visits 40 passed, patients 25 passed, workflows 7 passed, security 27 passed.
- Full backend: 405 passed. Django check passed. Migration drift check reported no changes detected.

## Browser QA - Pending Execution

Browser QA is pending execution with seeded local QA accounts; credentials are available. Verify patient and own-visit PNG/JPEG upload, protected original/overlay rendering, saved/external AI behavior, returned English/Arabic disclaimers, Admin/Staff read-only saved-X-ray behavior, Doctor external attach with and without an own visit, Admin discard, Staff external-route denial, unsupported/oversize uploads, and 1440/1280/1024/768 layouts.
