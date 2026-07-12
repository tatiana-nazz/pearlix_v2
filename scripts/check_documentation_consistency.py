"""Fail fast when Phase 14B UI refocus documentation drifts."""

from __future__ import annotations

from pathlib import Path
import re
import sys


ROOT = Path(__file__).resolve().parents[1]
STATUS = ROOT / "backend/project_docs/PROJECT_STATUS.md"
README = ROOT / "frontend/README.md"
AUDIT = ROOT / "backend/project_docs/FRONTEND_BACKEND_INTEGRATION_AUDIT.md"
QA = ROOT / "frontend/QA_14B.md"
V2 = ROOT / "frontend/design_v2"
REQUIRED_V2 = {
    "UI_REFOCUS_MANIFEST.md", "UI_AUDIT.md", "VISUAL_DIRECTION.md", "TOKENS_V2.md",
    "SHELL_SPEC_V2.md", "ICON_MAP.md", "COMPONENT_SPEC_V2.md", "DASHBOARD_SPEC_V2.md",
    "TABLE_LIST_SPEC_V2.md", "PATIENT_ROW_SPEC_V2.md", "FORM_INPUT_SPEC_V2.md",
    "OVERLAY_INTERACTION_SPEC_V2.md", "TEAM_USERS_ACCESS_SPEC_V2.md", "SCREEN_SPECS_V2.md",
    "RESPONSIVE_RTL_SPEC_V2.md", "DESIGN_ACCEPTANCE_MATRIX.md", "IMPLEMENTATION_SEQUENCE.md",
}


def require(text: str, phrase: str, source: str, errors: list[str]) -> None:
    if phrase.lower() not in text.lower():
        errors.append(f"{source} is missing required phrase: {phrase!r}")


def main() -> int:
    errors: list[str] = []
    for path in (STATUS, README, AUDIT, QA):
        if not path.exists():
            errors.append(f"Missing required document: {path.relative_to(ROOT)}")
    missing = sorted(name for name in REQUIRED_V2 if not (V2 / name).is_file())
    errors.extend(f"Missing required design_v2 deliverable: {name}" for name in missing)
    if errors:
        print("Documentation consistency check failed:", *errors, sep="\n- ")
        return 1

    status = STATUS.read_text(encoding="utf-8")
    for phrase in (
        "Current completed phase: 14B",
        "Next phase: 14C.0 Doctor/Staff professional profile API and account linkage",
        "407 passed",
        "51 passed",
        "runtime changes in Phase 14B: none",
        "Migrations in Phase 14B: none",
        "deployment paused",
    ):
        require(status, phrase, "PROJECT_STATUS", errors)
    if re.search(r"(?:Current completed phase|Next phase):[^\n]*14B[^\n]*(?:pending|next)", status, re.I):
        errors.append("PROJECT_STATUS describes Phase 14B as pending or next.")
    if re.search(r"(?:Next phase|Next step):[^\n]*(?:deployment|live UAT)", status, re.I):
        errors.append("PROJECT_STATUS presents deployment or live UAT as next.")

    manifest = (V2 / "UI_REFOCUS_MANIFEST.md").read_text(encoding="utf-8")
    shell = (V2 / "SHELL_SPEC_V2.md").read_text(encoding="utf-8")
    icon_map = (V2 / "ICON_MAP.md").read_text(encoding="utf-8")
    table = (V2 / "TABLE_LIST_SPEC_V2.md").read_text(encoding="utf-8")
    overlay = (V2 / "OVERLAY_INTERACTION_SPEC_V2.md").read_text(encoding="utf-8")
    patient = (V2 / "PATIENT_ROW_SPEC_V2.md").read_text(encoding="utf-8")
    team = (V2 / "TEAM_USERS_ACCESS_SPEC_V2.md").read_text(encoding="utf-8")
    form = (V2 / "FORM_INPUT_SPEC_V2.md").read_text(encoding="utf-8")
    visual = (V2 / "VISUAL_DIRECTION.md").read_text(encoding="utf-8")
    responsive = (V2 / "RESPONSIVE_RTL_SPEC_V2.md").read_text(encoding="utf-8")
    checks = (
        (manifest, "current accepted defect", "manifest"),
        (shell, "fixed", "shell"), (shell, "Light/Dark", "shell"), (shell, "EN/AR", "shell"),
        (icon_map, "Lucide React", "icon map"), (table, "Show more", "table/list spec"),
        (table, "whole eligible row", "table/list spec"), (overlay, "outside click", "overlay spec"),
        (overlay, "Dirty forms", "overlay spec"), (patient, "avatar", "patient row spec"),
        (team, "Users & Access", "Team/access spec"), (team, "Phase 14C.0", "Team/access spec"),
        (form, "searchable", "form spec"), (visual, "stronger", "visual direction"),
        (responsive, "Dark", "responsive spec"), (responsive, "Arabic", "responsive spec"),
        (responsive, "RTL", "responsive spec"),
    )
    for text, phrase, source in checks:
        require(text, phrase, source, errors)

    for path in (README, AUDIT, QA):
        text = path.read_text(encoding="utf-8")
        if re.search(r"Phase 14B(?: Complete UI Refocus Design Freeze| Visual Audit and Design Freeze)?\s+(?:is|remains)\s+(?:pending|next|unstarted)", text, re.I):
            errors.append(f"{path.relative_to(ROOT)} describes Phase 14B as pending/next.")
        if re.search(r"(?:deployment|live UAT).{0,60}(?:next|immediate)", text, re.I):
            errors.append(f"{path.relative_to(ROOT)} presents deployment/live UAT as next.")

    if errors:
        print("Documentation consistency check failed:")
        for error in errors:
            print(f"- {error}")
        return 1
    print("Documentation consistency check passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
