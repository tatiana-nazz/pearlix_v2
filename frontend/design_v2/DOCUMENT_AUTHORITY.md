# Documentation authority

Runtime behavior is defined by repository code and tests. Backend contracts, financial rules, and permissions outrank every design document.

- **Active authority:** backend contracts; frontend routes, components, tests, `FRONTEND_DESIGN_SYSTEM_SOURCE_OF_TRUTH.md`, `TOKENS_V2.md`, `DESIGN_ACCEPTANCE_MATRIX.md`, and the closed-state `DESIGN_ALIGNMENT_STATUS.md` snapshot.
- **Conditional reference:** route maps, visual direction, screen blueprints, overlay specifications, and the directly relevant completed-stage record when a current implementation question requires it.
- **Completed alignment records:** `MEDICAL_BLUE_FINAL_AUDIT.md`, `MEDICAL_BLUE_CLOSURE_RECORD.md`, `DESIGN_ALIGNMENT_HISTORY.md`, and Stage 1–9 records document verified completion but do not override runtime authority.
- **Historical/superseded:** `frontend/design/`, old QA files, phase records, and completed-stage records. They explain chronology but do not override current code and are excluded from default reading.
- **Evidence only:** screenshots and evidence indexes, including `design_alignment_evidence/final-audit/`, prove a captured state; they do not define product behavior.
- **Generated/temporary:** build output, local seed state, browser caches, and transient runtime files.
- **Do not use for implementation decisions:** superseded prompts, stale status instructions, and old closure reports.

`frontend/design_v2/` supersedes `frontend/design/`. `DESIGN_ALIGNMENT_HISTORY.md` holds completed-stage chronology; `DESIGN_ALIGNMENT_STATUS.md` is the current closed snapshot; `MEDICAL_BLUE_FINAL_AUDIT.md` and `MEDICAL_BLUE_CLOSURE_RECORD.md` are the Stage 10 closure records.
