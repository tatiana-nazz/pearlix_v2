# Document Authority Register

**Authority marker:** `CURRENT_CANONICAL_AUTHORITY_REGISTER`
**Last reconciled:** 2026-07-25
**Owner / next responsibility:** Phase 14E documentation governance; every future feature owner updates only the rows affected by its approved work.

Read [`../../CODEX_START_HERE.md`](../../CODEX_START_HERE.md) first. This register is the sole index of documents allowed to claim project-wide binding/current authority. Current Doctor authorization is all active/non-archived patients; it is not narrow object-level scoped-patient access.

## Precedence

Latest user-approved decisions > `CODEX_START_HERE.md` > `PROJECT_STATUS.md` > current backend/role decisions > current product/UI authority > affected runtime contracts/tests > QA evidence/supporting specifications > historical material. Runtime code does not silently cancel an explicit current decision requiring later implementation; record the gap.

| Path / document | Classification | Scope / Codex read | Current / replacement / conflict notes |
| --- | --- | --- | --- |
| `CODEX_START_HERE.md` | CURRENT_CANONICAL | All tasks; mandatory | Current root authority entry. |
| `backend/project_docs/DOCUMENT_AUTHORITY_REGISTER.md` | CURRENT_CANONICAL | All tasks; mandatory | Current inventory and classifications. |
| `backend/project_docs/PROJECT_STATUS.md` | CURRENT_CANONICAL | All tasks; mandatory | Current status/baseline; link to root entry required. |
| `backend/project_docs/CURRENT_BACKEND_DECISIONS.md` | CURRENT_CANONICAL | Backend/role/patient work | Current backend and role summary; runtime/tests remain required. |
| `frontend/CURRENT_PRODUCT_UI_SOURCE_OF_TRUTH.md` | CURRENT_CANONICAL | Frontend/product/design work | Current reconciled UI/product rules. |
| `backend/project_docs/FRONTEND_BACKEND_INTEGRATION_AUDIT.md` | CURRENT_SUPPORTING | Integration changes | Contract evidence, not product authority. |
| `backend/project_docs/BACKEND_PHASE_TRACKER.md` | CURRENT_SUPPORTING | Backend phase work | Phase evidence; defer status to `PROJECT_STATUS.md`. |
| `backend/project_docs/PHASE_14R_BACKEND_REGRESSION_STABILIZATION.md` | IMPLEMENTATION_RECORD | Scheduling regression work | Historical implementation/QA evidence. |
| `backend/project_docs/PHASE_14C0_TEAM_PROFILE_ARCHITECTURE.md` | CURRENT_SUPPORTING | Team/account contracts | Current technical contract; not product authority. |
| `backend/project_docs/LOCAL_DEVELOPMENT.md`, `backend/README.md`, `frontend/README.md` | CURRENT_SUPPORTING | Setup/local troubleshooting | Operational instructions; defer authority decisions to root entry. |
| `frontend/design_v2/UI_REFOCUS_MANIFEST.md` | CURRENT_SUPPORTING | UI implementation context | Historical design freeze plus supporting design detail; reconciled UI authority wins. |
| `frontend/design_v2/{SHELL_SPEC_V2,SCREEN_BLUEPRINTS_V2,SCREEN_SPECS_V2,COMPONENT_SPEC_V2,FORM_INPUT_SPEC_V2,OVERLAY_INTERACTION_SPEC_V2,TABLE_LIST_SPEC_V2,RESPONSIVE_RTL_SPEC_V2,TOKENS_V2,ICON_MAP}.md` | CURRENT_SUPPORTING | Approved scoped UI implementation | Supporting specs only; do not override product/role decisions. |
| `frontend/design_v2/{DASHBOARD_SPEC_V2,TEAM_USERS_ACCESS_SPEC_V2,PATIENT_ROW_SPEC_V2,DESIGN_ACCEPTANCE_MATRIX,RUNTIME_COMPONENT_MAPPING_V2,VISUAL_DIRECTION}.md` | CURRENT_SUPPORTING | Affected UI feature work | Supporting design evidence; some sections are historical and cannot override the current UI authority. |
| `frontend/design_v2/IMPLEMENTATION_SEQUENCE.md` | SUPERSEDED | Do not use as a phase plan | Replaced by `PROJECT_STATUS.md` and current UI authority; phases 14C–14D are delivered. |
| `frontend/design_v2/UI_AUDIT.md` | IMPLEMENTATION_RECORD | Design-history context | Accepted 14B audit baseline, not current defect/phase authority. |
| `frontend/design_v2/{PHASE_14C_IMPLEMENTATION_RECORD,PHASE_14D_BROWSER_ACCEPTANCE_RECORD,PHASE_14D1_TEAM_USERS_ACCESS_IMPLEMENTATION_RECORD,PHASE_14D2_ROLE_DASHBOARD_IMPLEMENTATION_RECORD,PHASE_14D3_APPOINTMENTS_IMPLEMENTATION_RECORD,PHASE_14D3A_APPOINTMENTS_CLOSURE_RECORD,PHASE_14D4_PATIENT_WORKSPACE_IMPLEMENTATION_RECORD,PHASE_14D4A_PATIENT_CLOSURE_RECORD,PHASE_14E1_ACTION_HIERARCHY_IMPLEMENTATION_RECORD,PHASE_14E1A_COLLECTION_ACTION_CLOSURE_RECORD,LOCAL_LOGIN_NETWORK_FIX_RECORD}.md` | IMPLEMENTATION_RECORD | Related troubleshooting only | Evidence of delivered work; must not redefine product behavior. |
| `frontend/QA_*.md` | QA_EVIDENCE | Related acceptance only | Historical/current acceptance evidence, never product authority. |
| `backend/project_docs/{BACKEND_FINAL_HANDOFF,DEMO_STORY,DEV_QA_ACCOUNTS,PHASE_14C0_MIGRATION_AND_INTEGRITY_REPORT}.md` | IMPLEMENTATION_RECORD | Related operation/history | Preserve as evidence; defer current status to root/status. |
| `frontend/design/{DESIGN_SYSTEM,RESPONSIVE_LAYOUT_SPEC,COMPONENT_CONTRACT,SCREEN_BLUEPRINTS,INTERACTION_STATES}.md` | SUPERSEDED | Do not guide new UI | Replaced by current UI authority and v2 supporting specs; useful historical evidence. |
| `_codex_backend_handoff/00_CODEX_START_HERE.md` | SUPERSEDED | Do not use as root instructions | Replaced by root `CODEX_START_HERE.md`; useful Phase 12 evidence. |
| `_codex_backend_handoff/{01_PROJECT_SOURCE_OF_TRUTH_DETAILED,02_BACKEND_ARCHITECTURE_DETAILED,03_DATA_MODEL_DETAILED,04_PERMISSIONS_MATRIX_DETAILED,05_API_CONTRACT_DETAILED,06_SECURITY_THREAT_MODEL_DETAILED,07_TESTING_MASTER_PLAN,08_TEST_CASE_MATRIX_BY_MODULE,09_WORKFLOW_E2E_TESTS,10_PYTEST_FIXTURES_AND_FACTORIES,11_CODEX_PROMPTING_RULES,12_BACKEND_PHASE_PLAN_DETAILED,13_PHASE_12A_BACKEND_FOUNDATION_PROMPT,14_PHASE_12B_ACCOUNTS_CLINIC_PROMPT,15_PHASE_12C_PATIENTS_PROMPT,16_PHASE_12D_SCHEDULES_PROMPT,17_PHASE_12E_APPOINTMENTS_PROMPT,18_PHASE_12F_VISITS_CLINICAL_NOTES_PROMPT,19_PHASE_12G_SAVED_XRAYS_AI_PROMPT,20_PHASE_12H_EXTERNAL_XRAY_AI_PROMPT,21_PHASE_12I_BILLING_PROMPT,22_PHASE_12J_DASHBOARD_AUDIT_PROTECTED_MEDIA_PROMPT,23_PHASE_12K_SECURITY_QA_REGRESSION_PROMPT,24_PHASE_12L_DEPLOYMENT_PREP_OPTIONAL_PROMPT,25_BACKEND_DONE_DEFINITION,25_POST_12K_CORRECTIONS_SOURCE_OF_TRUTH,PROMPT_INDEX}.md` | HISTORICAL_REFERENCE | Never mandatory for current implementation | Phase 12/legacy history only; may not override current role/UI/runtime authority. |
| `FRONTEND_COMPLETE_UI_UX_SOURCE_OF_TRUTH.md` (if added) | REQUIRES_RECONCILIATION | Visual guidance only | External user design reference; classify visual guidance as supporting and stale functional/role/navigation assertions as superseded before use. File was absent at reconciliation. |

Generated files, `.env` files, build output, virtual environments, screenshots, and browser evidence are `GENERATED_OR_NONAUTHORITATIVE` and must not guide decisions. The rejected historical preview is `HISTORICAL_REFERENCE` only: branch `preview-pre-v2-ui`, worktree `D:\pearlix_v2_pre_v2_preview`, commit `bdd5f6f`.
