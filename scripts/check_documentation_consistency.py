"""Fail fast on Phase 14D closure documentation drift (standard library only)."""
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
FILES = {
    "status": "backend/project_docs/PROJECT_STATUS.md", "audit": "backend/project_docs/FRONTEND_BACKEND_INTEGRATION_AUDIT.md",
    "readme": "frontend/README.md", "qa": "frontend/QA_14D.md", "record": "frontend/design_v2/PHASE_14D_IMPLEMENTATION_RECORD.md",
    "mapping": "frontend/design_v2/RUNTIME_COMPONENT_MAPPING_V2.md", "matrix": "frontend/design_v2/DESIGN_ACCEPTANCE_MATRIX.md",
}

def main() -> int:
    errors, text = [], {}
    for key, relative in FILES.items():
        path = ROOT / relative
        if not path.is_file(): errors.append(f"missing {relative}")
        else: text[key] = path.read_text(encoding="utf-8").lower()
    expected = {
        "status": ("current completed phase: 14d", "next phase: phase 14e", "backend runtime changes in phase 14d: no", "migrations in phase 14d: none"),
        "audit": ("completed phase 14d", "backend runtime changed in phase 14d: no"),
        "readme": ("phase 14d is complete", "phase 14e"),
        "qa": ("phase 14d implementation is complete", "browser qa", "appointment"),
        "record": ("phase 14d", "implementation record"),
        "mapping": ("centered appointment modal",), "matrix": ("ap-d", "pat-l"),
    }
    for key, phrases in expected.items():
        for phrase in phrases:
            if phrase not in text.get(key, ""): errors.append(f"{key} missing {phrase!r}")
    joined = "\n".join(text.values())
    for stale in ("phase 14d is next", "appointment drawer", "browser qa: complete"):
        if stale in joined: errors.append(f"stale wording: {stale!r}")
    if errors:
        print("Documentation consistency check failed:\n- " + "\n- ".join(errors)); return 1
    print("Documentation consistency check passed."); return 0

if __name__ == "__main__": raise SystemExit(main())
