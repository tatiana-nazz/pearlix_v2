"""Fail fast when completed Phase 14C.0 documentation drifts."""

from __future__ import annotations

from pathlib import Path
import re
import sys


ROOT = Path(__file__).resolve().parents[1]
STATUS = ROOT / "backend/project_docs/PROJECT_STATUS.md"
README = ROOT / "frontend/README.md"
AUDIT = ROOT / "backend/project_docs/FRONTEND_BACKEND_INTEGRATION_AUDIT.md"
QA = ROOT / "frontend/QA_14C0.md"
TEAM_ARCHITECTURE = ROOT / "backend/project_docs/PHASE_14C0_TEAM_PROFILE_ARCHITECTURE.md"
MIGRATION_REPORT = ROOT / "backend/project_docs/PHASE_14C0_MIGRATION_AND_INTEGRITY_REPORT.md"
V2 = ROOT / "frontend/design_v2"
REQUIRED_V2 = {
    "UI_REFOCUS_MANIFEST.md", "UI_AUDIT.md", "VISUAL_DIRECTION.md", "TOKENS_V2.md",
    "SHELL_SPEC_V2.md", "ICON_MAP.md", "COMPONENT_SPEC_V2.md", "DASHBOARD_SPEC_V2.md",
    "TABLE_LIST_SPEC_V2.md", "PATIENT_ROW_SPEC_V2.md", "FORM_INPUT_SPEC_V2.md",
    "OVERLAY_INTERACTION_SPEC_V2.md", "TEAM_USERS_ACCESS_SPEC_V2.md", "SCREEN_SPECS_V2.md",
    "RESPONSIVE_RTL_SPEC_V2.md", "DESIGN_ACCEPTANCE_MATRIX.md", "IMPLEMENTATION_SEQUENCE.md",
    "SCREEN_BLUEPRINTS_V2.md", "RUNTIME_COMPONENT_MAPPING_V2.md",
}


def require(text: str, phrase: str, source: str, errors: list[str]) -> None:
    if phrase.lower() not in text.lower():
        errors.append(f"{source} is missing required phrase: {phrase!r}")


def main() -> int:
    errors: list[str] = []
    for path in (STATUS, README, AUDIT, QA, TEAM_ARCHITECTURE, MIGRATION_REPORT):
        if not path.exists():
            errors.append(f"Missing required document: {path.relative_to(ROOT)}")
    missing = sorted(name for name in REQUIRED_V2 if not (V2 / name).is_file())
    errors.extend(f"Missing required design_v2 deliverable: {name}" for name in missing)
    if errors:
        print("Documentation consistency check failed:", *errors, sep="\n- ")
        return 1

    status = STATUS.read_text(encoding="utf-8")
    readme = README.read_text(encoding="utf-8")
    audit = AUDIT.read_text(encoding="utf-8")
    qa = QA.read_text(encoding="utf-8")
    for phrase in (
        "Current completed phase: 14C.0 Team Profile API and Account Linkage Foundation",
        "Next phase: 14C Shell, tokens, Lucide icons, and shared components",
        "414 passed",
        "52 passed",
        "accounts.0005",
        "deployment paused",
    ):
        require(status, phrase, "PROJECT_STATUS", errors)
    if re.search(r"(?:Current completed phase|Next phase):[^\n]*14C\.0[^\n]*(?:pending|next|unstarted)", status, re.I):
        errors.append("PROJECT_STATUS describes Phase 14C.0 as pending or next.")
    if re.search(r"(?:Next phase|Next step):[^\n]*(?:deployment|live UAT)", status, re.I):
        errors.append("PROJECT_STATUS presents deployment or live UAT as next.")
    if "unsupported doctorprofile/staffprofile crud" in status.lower():
        errors.append("PROJECT_STATUS still presents implemented professional-profile APIs as unsupported.")

    manifest = (V2 / "UI_REFOCUS_MANIFEST.md").read_text(encoding="utf-8")
    shell = (V2 / "SHELL_SPEC_V2.md").read_text(encoding="utf-8")
    icon_map = (V2 / "ICON_MAP.md").read_text(encoding="utf-8")
    table = (V2 / "TABLE_LIST_SPEC_V2.md").read_text(encoding="utf-8")
    overlay = (V2 / "OVERLAY_INTERACTION_SPEC_V2.md").read_text(encoding="utf-8")
    patient = (V2 / "PATIENT_ROW_SPEC_V2.md").read_text(encoding="utf-8")
    team = (V2 / "TEAM_USERS_ACCESS_SPEC_V2.md").read_text(encoding="utf-8")
    architecture = TEAM_ARCHITECTURE.read_text(encoding="utf-8")
    migration_report = MIGRATION_REPORT.read_text(encoding="utf-8")
    form = (V2 / "FORM_INPUT_SPEC_V2.md").read_text(encoding="utf-8")
    visual = (V2 / "VISUAL_DIRECTION.md").read_text(encoding="utf-8")
    responsive = (V2 / "RESPONSIVE_RTL_SPEC_V2.md").read_text(encoding="utf-8")
    blueprints = (V2 / "SCREEN_BLUEPRINTS_V2.md").read_text(encoding="utf-8")
    matrix = (V2 / "DESIGN_ACCEPTANCE_MATRIX.md").read_text(encoding="utf-8")
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
        (blueprints, "/admin/dashboard", "route blueprints"),
        (blueprints, "/admin/team", "route blueprints"),
        (blueprints, "/admin/users", "route blueprints"),
        (blueprints, "/staff/patients", "route blueprints"),
        (blueprints, "appointments/day", "route blueprints"),
        (blueprints, "Doctor active visit", "route blueprints"),
        (blueprints, "saved X-ray", "route blueprints"),
        (blueprints, "invoice list/new/detail", "route blueprints"),
        (blueprints, "clinic settings", "route blueprints"),
        (blueprints, "audit list/detail", "route blueprints"),
        (matrix, "DB-ADM", "acceptance matrix"), (matrix, "TEAM-L", "acceptance matrix"),
        (matrix, "AP-D", "acceptance matrix"), (matrix, "WIDTH-01", "acceptance matrix"),
        (team, "GET /api/team-members/", "Team API contract"),
        (team, "POST /api/users/{id}/transition-role/", "Team API contract"),
        (team, "Reactivation is implemented", "Team API contract"),
        (architecture, "User.id", "Team architecture"),
        (architecture, "ROLE_TRANSITION_BLOCKED_BY_HISTORY", "Team architecture"),
        (architecture, "Generic role PATCH", "Team architecture"),
        (migration_report, "check_profile_integrity", "migration report"),
        (visual, "Noto Sans Arabic", "Arabic typography"),
        (responsive, "unicode-bidi:isolate", "Arabic bidi rules"),
    )
    for text, phrase, source in checks:
        require(text, phrase, source, errors)

    for phrase in (
        "GET /api/team-members/",
        "POST /api/team-members/",
        "POST /api/users/{id}/transition-role/",
        "POST /api/users/{id}/reactivate/",
        "Admin accounts only",
        "linked_profile_state",
    ):
        require(audit, phrase, "integration audit", errors)
    for phrase in (
        "40 passed",
        "414 passed",
        "52 passed",
        "Django check: passed",
        "Migration drift: none",
        "Documentation consistency checker: passed",
        "git diff --check",
    ):
        require(qa, phrase, "QA_14C0", errors)

    historical_order = audit[audit.find("## O. Historical Phase Order") :]
    historical_14b = historical_order.find("14B")
    historical_14c0 = historical_order.find("14C.0")
    if historical_14b == -1 or historical_14c0 == -1 or historical_14b >= historical_14c0:
        errors.append("Integration audit must record Phase 14B before Phase 14C.0 in historical order.")

    for path in (STATUS, README, AUDIT, QA, TEAM_ARCHITECTURE, MIGRATION_REPORT):
        text = path.read_text(encoding="utf-8")
        if re.search(r"Phase 14C\.0\s+(?:is|remains|as)\s+(?:mandatory|pending|next|unstarted|not implemented)", text, re.I):
            errors.append(f"{path.relative_to(ROOT)} describes Phase 14C.0 as pending/next.")
        if re.search(r"(?:next is|next phase:)[^\n]{0,40}phase 14b", text, re.I):
            errors.append(f"{path.relative_to(ROOT)} presents Phase 14B as next.")
        if re.search(r"(?:next|immediate)\s+(?:phase\s+)?(?:deployment|live UAT)", text, re.I):
            errors.append(f"{path.relative_to(ROOT)} presents deployment/live UAT as next.")

    if "QA_14C0.md" not in readme or "authoritative UI refocus" not in readme:
        errors.append("README must reference QA_14C0 and designate design_v2 as authoritative.")
    if re.search(r"Ongoing product work must follow.*frontend/design/", readme, re.I | re.S):
        errors.append("README still presents old frontend/design as the ongoing authoritative contract.")

    if errors:
        print("Documentation consistency check failed:")
        for error in errors:
            print(f"- {error}")
        return 1
    print("Documentation consistency check passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
