"""Fail fast on Phase 14D closure-documentation drift (standard library only)."""
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
FILES = {
    "status": "backend/project_docs/PROJECT_STATUS.md",
    "audit": "backend/project_docs/FRONTEND_BACKEND_INTEGRATION_AUDIT.md",
    "readme": "frontend/README.md",
    "qa": "frontend/QA_14D.md",
    "record": "frontend/design_v2/PHASE_14D_IMPLEMENTATION_RECORD.md",
    "mapping": "frontend/design_v2/RUNTIME_COMPONENT_MAPPING_V2.md",
    "matrix": "frontend/design_v2/DESIGN_ACCEPTANCE_MATRIX.md",
    "blueprints": "frontend/design_v2/SCREEN_BLUEPRINTS_V2.md",
}


def main() -> int:
    errors: list[str] = []
    text: dict[str, str] = {}
    for key, relative in FILES.items():
        path = ROOT / relative
        if not path.is_file():
            errors.append(f"missing {relative}")
        else:
            text[key] = path.read_text(encoding="utf-8").lower()

    expected = {
        "status": ("phase 14d acceptance corrections in progress", "next phase: phase 14e", "backend runtime changes in phase 14d: no", "migrations in phase 14d: none", "phase 14f"),
        "audit": ("phase 14d acceptance corrections are in progress", "phase 14f"),
        "readme": ("phase 14d acceptance corrections are in progress", "phase 14e"),
        "qa": ("phase 14d acceptance corrections are in progress", "browser qa", "phase 14f", "phase 14e"),
        "record": ("phase 14d acceptance corrections are in progress", "backend runtime changed: no", "migrations: none"),
        "mapping": ("phase 14d closure", "phase 14e is next"),
        "matrix": ("phase 14d automated closure", "phase 14f"),
        "blueprints": ("phase 14d closure note", "phase 14f"),
    }
    for key, phrases in expected.items():
        for phrase in phrases:
            if phrase not in text.get(key, ""):
                errors.append(f"{key} missing {phrase!r}")

    joined = "\n".join(text.values())
    stale = (
        "phase 14d is complete",
        "current completed phase: phase 14d",
        "phase 14d is next",
        "92 frontend tests",
        "92 passed",
        "94 tests",
        "browser qa: complete",
        "browser qa completed",
        "phase 14e has started",
    )
    for phrase in stale:
        if phrase in joined:
            errors.append(f"stale wording: {phrase!r}")

    if errors:
        print("Documentation consistency check failed:\n- " + "\n- ".join(errors))
        return 1
    print("Documentation consistency check passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
