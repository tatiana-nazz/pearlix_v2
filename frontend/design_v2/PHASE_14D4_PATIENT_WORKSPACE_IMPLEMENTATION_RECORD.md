# Phase 14D.4 Patient Workspace Implementation Record

Starting branch: `phase-14d3a-appointments-contract-closure`. Starting commit: `748685a02ebd62f42e0cc90d17181e431a520dae`.

Phase 14D.4 refines the existing role-aware patient workspace only: directory, server-backed search/pagination/archive filter, Staff creation, read-first detail, explicit general and medical-history edit modes, versioned updates, archive/reactivation, and bounded related summaries. Routes remain role-scoped `/[role]/patients`, `/[role]/patients/new` (Staff), and `/[role]/patients/:patientId`.

The create form is General Information only. Medical history is edited from the dedicated detail tab. Patient list rows remain free of clinical notes and protected-media URLs. The frontend preserves backend authority: Admin is read-only, Staff owns creation/archive actions, Doctor access remains active-patient scoped, and the serializer/service retain version and archive rules.

Patient copy is localized in English and Arabic. The directory, forms, profile tabs, and status presentation use existing v2 tokens and logical layout. Tabs now expose tab/tab-panel relationships with Arrow, Home, and End navigation. List rows are keyboard-accessible. Patient mutations invalidate patient lists/details, dashboards, availability, and appointment patient-search caches.

No backend runtime or external API contract changed; no migration was created. Added focused tests cover General Information-only creation and tab keyboard activation. Final verification: 106 frontend tests in 38 files; 420 backend tests at baseline. Browser QA was not executed. Existing React Router and React `act(...)` warnings persist in unrelated tests; build retains the 529.60 kB chunk-size advisory.
