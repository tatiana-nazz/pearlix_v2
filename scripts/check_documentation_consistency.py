"""Fail fast on Phase 14C closure documentation drift (standard library only)."""
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
FILES = {
    "status": "backend/project_docs/PROJECT_STATUS.md", "audit": "backend/project_docs/FRONTEND_BACKEND_INTEGRATION_AUDIT.md",
    "readme": "frontend/README.md", "qa": "frontend/QA_14C.md", "record": "frontend/design_v2/PHASE_14C_IMPLEMENTATION_RECORD.md",
    "mapping": "frontend/design_v2/RUNTIME_COMPONENT_MAPPING_V2.md", "matrix": "frontend/design_v2/DESIGN_ACCEPTANCE_MATRIX.md",
}
SCOPE = "phase 14d — priority workflows: dashboards, appointments, patients, team, and users & access"

def main() -> int:
    errors, text = [], {}
    for key, relative in FILES.items():
        path = ROOT / relative
        if not path.is_file(): errors.append(f"missing {relative}")
        else: text[key] = path.read_text(encoding="utf-8").lower()
    checks = {
        "status": ("current completed phase: 14c", SCOPE, "75 passed", "backend runtime changes in phase 14c: no", "migrations in phase 14c: none", "implement phases 14d–14f"),
        "audit": ("completed phase 14c shell", SCOPE, "14c — shell", "no `/admin/team` runtime route"),
        "readme": ("phase 14c added", "23 focused phase 14c tests", "75 total frontend tests", SCOPE, "design_v2/` is the authoritative"),
        "qa": ("focused automated coverage", "23 passed", "75 passed", "collapse persistence", "browser qa is pending"),
        "record": ("phase 14c is complete", "shared modal/drawer/confirmdialog foundation is complete", SCOPE, "browser qa remains pending"),
        "mapping": ("shared v2 overlay foundation is complete", "appointmentconfirmdialog.tsx", "14d, remove"),
        "matrix": ("phase 14c",),
    }
    for key, phrases in checks.items():
        for phrase in phrases:
            if phrase not in text.get(key, ""): errors.append(f"{key} missing {phrase!r}")
    joined = "\n".join(text.values())
    for stale in ("next is phase 14c", "phase 14c shell/token/shared-component work is next", "final team and users & access runtime ui (phase 14d)"):
        if stale in joined: errors.append(f"stale current-phase wording: {stale!r}")
    if "66 passed" in text.get("status", "") or "66 passed" in text.get("qa", ""): errors.append("frontend total remains the pre-final Phase 14C baseline")
    if "14 focused foundation tests" in text.get("readme", ""):
        errors.append("README still reports 14 focused Phase 14C tests")
    if "23 focused phase 14c tests" not in text.get("readme", ""):
        errors.append("README does not report 23 focused Phase 14C tests")
    if "75 total frontend tests" not in text.get("readme", ""):
        errors.append("README does not report 75 total frontend tests")
    if "production contract through completed phase 14c.0" in text.get("audit", ""):
        errors.append("integration audit final completion statement still stops at Phase 14C.0")
    if "production contract through completed phase 14c." not in text.get("audit", ""):
        errors.append("integration audit does not state current contract through completed Phase 14C")
    if "browser qa: complete" in joined or "browser acceptance complete" in joined: errors.append("browser QA is falsely complete")
    if errors:
        print("Documentation consistency check failed:\n- " + "\n- ".join(errors)); return 1
    print("Documentation consistency check passed."); return 0

if __name__ == "__main__": raise SystemExit(main())
