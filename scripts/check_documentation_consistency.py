"""Fail fast on Phase 14D final-closure documentation drift (standard library only)."""
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
FILES = {
    "status": "backend/project_docs/PROJECT_STATUS.md", "audit": "backend/project_docs/FRONTEND_BACKEND_INTEGRATION_AUDIT.md",
    "readme": "frontend/README.md", "qa": "frontend/QA_14D.md", "record": "frontend/design_v2/PHASE_14D_IMPLEMENTATION_RECORD.md",
    "mapping": "frontend/design_v2/RUNTIME_COMPONENT_MAPPING_V2.md", "matrix": "frontend/design_v2/DESIGN_ACCEPTANCE_MATRIX.md",
    "blueprints": "frontend/design_v2/SCREEN_BLUEPRINTS_V2.md",
}

def main() -> int:
    errors, text = [], {}
    for key, relative in FILES.items():
        path = ROOT / relative
        if not path.is_file(): errors.append(f"missing {relative}")
        else: text[key] = path.read_text(encoding="utf-8").lower()
    expected = {
        "status": ("current completed phase: phase 14d", "next phase: phase 14e", "92 passed", "focused backend verification: appointment 40 passed; patient 25 passed", "backend runtime changes in phase 14d: no", "migrations in phase 14d: none", "phase 14f"),
        "audit": ("current status through phase 14d", "tatiana-nazz/pearlix_v2", "/admin/team", "phase 14e is next"),
        "readme": ("phase 14d is complete", "92 frontend tests", "qa_14d.md", "phase 14e"),
        "qa": ("phase 14d implementation is complete", "browser qa", "phase 14f"),
        "record": ("phase 14d", "backend runtime changed: no", "migrations: none"),
        "mapping": ("centered appointment modal",),
        "matrix": ("approved four primary kpi cards",),
        "blueprints": ("centered detail/form modal",),
    }
    for key, phrases in expected.items():
        for phrase in phrases:
            if phrase not in text.get(key, ""): errors.append(f"{key} missing {phrase!r}")
    joined = "\n".join(text.values())
    stale = ("current completed phase: 14c", "next phase: phase 14d", "next step: implement the complete approved phase 14d", "phase 14d is next", "final screens are phase 14d", "team and users & access runtime ui is remaining", "no `/admin/team` runtime route", "appointment drawer", "selected detail drawer", "phase 14d is not complete", "browser qa: complete", "tatiana-tay/pearlix_v2")
    for phrase in stale:
        if phrase in joined: errors.append(f"stale wording: {phrase!r}")
    if errors:
        print("Documentation consistency check failed:\n- " + "\n- ".join(errors)); return 1
    print("Documentation consistency check passed."); return 0

if __name__ == "__main__": raise SystemExit(main())
