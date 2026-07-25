# Phase 14D.4A Patient Workspace Contract-Closure Record

Starting commit: `27bde3ba1b701627c61f6cd4348665bc4f8b6c78` on `phase-14d4-patient-workspace-redesign`.

## Reason and method

Phase 14D.4A continued after the Phase 14D.4 delivery reported only two added patient tests. The audit read the runtime workspace, endpoint wrappers, patient selectors and permissions, serializer contracts, focused tests, shared date/formatting utilities, styles, and canonical backend decisions. It then exercised the changed user-facing form, row, tab, direct-detail, and mutation behavior with Testing Library and React Query tests.

## Canonical scope conclusion

The backend decision is intentionally broad: every active Doctor can read and update every active, non-archived patient and that patient's full clinical history. `my_patients`, `upcoming_with_me`, and `last_visit_with_me` are optional workflow-narrowing list filters, not object-access restrictions. Archived patient records are denied to Doctors. The existing selector, permission helper, and focused backend tests already enforce that contract; no backend change was warranted.

## Runtime corrections

- The creation form now offers the supported blood-group field while still excluding medical-history fields.
- Dirty form cancellation asks for confirmation and leaves the form open when dismissal is rejected.
- The profile's inaccessible Doctor billing URL now falls back consistently to the overview tab and its matching panel instead of producing mismatched tab/panel state.
- Patient directory/profile, overview, and medical-summary runtime copy now uses the centralized EN/AR dictionary; gender and missing values are localized in read-first detail output.
- Touched router tests opt in to supported React Router future flags, avoiding new warnings.

## Coverage additions

The closure adds direct behavioral coverage for exact creation payload/no derived age, dirty cancellation, keyboard row navigation, tab Home/End and associations, direct Doctor billing-tab fallback, and versioned update/archive cache invalidation. Existing tests continue to cover form field validation, backend field errors, archive wording/action/error, role controls, billing role navigation, and base tab navigation.

## Contract audits

Directory requests remain server-paged and use canonical search/filter keys. Detail is read-first; general and medical edits are separate and versioned. Archive/reactivation use dedicated versioned actions with retained-history wording. Related appointments, visits, billing, and X-ray/AI summaries consume patient-scoped bounded endpoints and do not expose protected media URLs or file paths. Related workflow redesigns remain out of scope. Dates use shared clinic-aware formatters; age is backend-derived and omitted from payloads. The query layer keys list/detail/related data separately and invalidates patients, detail, dashboards, and appointment availability after mutations.

## Verification and limitations

Final verification recorded 113 frontend tests in 40 files and 420 backend tests. Typecheck, production build, Django check, migration-drift check, focused patient tests, documentation consistency, and diff whitespace check pass. Browser/manual QA was not executed and remains pending. Visual responsive/theme acceptance and real-browser focus-trap verification remain separate browser gates. No backend runtime or external API contract changed and no migration was created.

Phase 14D.4 is contract-complete for the implemented patient workspace; visits, billing, X-ray, and AI workflow redesigns remain their own later phases.
