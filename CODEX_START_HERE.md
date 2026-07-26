# Pearlix: Current Documentation Authority

**Mandatory first read for every Codex task.** This repository is the Pearlix dental-clinic management system. Start from the current canonical status in [`backend/project_docs/PROJECT_STATUS.md`](backend/project_docs/PROJECT_STATUS.md); the verified implementation baseline is `e54a85842f1c683b27f12e0da93987ae128c861d` or an accepted descendant.

## Authority order

1. Latest explicit user-approved decisions.
2. This file.
3. [`PROJECT_STATUS.md`](backend/project_docs/PROJECT_STATUS.md).
4. [`CURRENT_BACKEND_DECISIONS.md`](backend/project_docs/CURRENT_BACKEND_DECISIONS.md) and the affected backend contracts/tests.
5. [`CURRENT_PRODUCT_UI_SOURCE_OF_TRUTH.md`](frontend/CURRENT_PRODUCT_UI_SOURCE_OF_TRUTH.md).
6. Affected runtime code, API contracts, routes, and tests.
7. Current QA acceptance evidence and supporting specifications.
8. Historical and superseded material, for context only.

The authoritative document inventory and classifications are in [`DOCUMENT_AUTHORITY_REGISTER.md`](backend/project_docs/DOCUMENT_AUTHORITY_REGISTER.md). Only documents registered there may claim globally binding/current authority.

## Current decisions that must not drift

- Team and Users & Access are distinct: Team is the professional-profile/availability workspace; Users & Access is account, login, security, and role management. Admin manages Team; Staff has a safe read-only Team projection; Doctor has no Team access. They are related, not one "Doctors & Staff" screen.
- Every active Doctor can read all active, non-archived patients, update approved demographics and Medical Conditions History, and read permitted clinical history. "My patients" and similar labels are workflow filters, never object-level authorization.
- Doctors cannot archive/reactivate patients, process payments, or receive global Billing.
- The current v2 UI continues from `e54a858`. The rejected `preview-pre-v2-ui` branch, its worktree, and `bdd5f6f` are **never** implementation sources.

## Operating rules

Before editing, identify relevant contradictions against this authority chain. Troubleshooting preserves current behavior; it must not become redesign or a functional rollback. Design changes require an explicit approved scope and must preserve functionality, RBAC, runtime contracts, and tests. Implementation records and QA prove history/evidence; they do not redefine product behavior. Read the affected tests and runtime contracts before changing a feature. User-approved decisions supersede stale documentation.
