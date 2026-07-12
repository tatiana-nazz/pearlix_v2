"""Validate the Phase 14C documentation handoff without third-party packages."""

from __future__ import annotations

from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
FILES = {
    "status": ROOT / "backend/project_docs/PROJECT_STATUS.md",
    "audit": ROOT / "backend/project_docs/FRONTEND_BACKEND_INTEGRATION_AUDIT.md",
    "readme": ROOT / "frontend/README.md",
    "qa": ROOT / "frontend/QA_14C.md",
    "record": ROOT / "frontend/design_v2/PHASE_14C_IMPLEMENTATION_RECORD.md",
    "mapping": ROOT / "frontend/design_v2/RUNTIME_COMPONENT_MAPPING_V2.md",
    "matrix": ROOT / "frontend/design_v2/DESIGN_ACCEPTANCE_MATRIX.md",
    "team": ROOT / "frontend/design_v2/TEAM_USERS_ACCESS_SPEC_V2.md",
}


def main() -> int:
    errors: list[str] = []
    text: dict[str, str] = {}
    for name, path in FILES.items():
        if not path.exists():
            errors.append(f"Missing required document: {path.relative_to(ROOT)}")
        else:
            text[name] = path.read_text(encoding="utf-8").lower()
    if errors:
        print("Documentation consistency check failed:\n- " + "\n- ".join(errors))
        return 1

    required = {
        "status": ("current completed phase: 14c", "next phase: 14d", "414 passed", "52 passed", "deployment paused"),
        "qa": ("272 px", "84 px", "72 px", "browser qa is pending", "/admin/team"),
        "record": ("lucide", "light/dark/system", "en/ar", "backend runtime changed: no", "migrations: none", "next phase: 14d"),
        "mapping": ("appshell", "sidebarnav", "workspaceheader"),
        "matrix": ("14c",),
        "audit": ("backend runtime",),
    }
    for source, phrases in required.items():
        for phrase in phrases:
            if phrase not in text[source]:
                errors.append(f"{source} is missing required phrase: {phrase!r}")
    if "14c shell, tokens, lucide icons, and shared components" in text["status"] and "next phase: 14c shell" in text["status"]:
        errors.append("PROJECT_STATUS still presents Phase 14C as next.")
    if "supported reactivation after api support" in text["team"]:
        errors.append("TEAM_USERS_ACCESS_SPEC_V2 contains stale reactivation wording.")
    if "post-mvp limitations" in text["status"] and "final team and users & access runtime ui" in text["status"]:
        errors.append("PROJECT_STATUS presents Phase 14D Team/Users UI as post-MVP.")
    if errors:
        print("Documentation consistency check failed:\n- " + "\n- ".join(errors))
        return 1
    print("Documentation consistency check passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
