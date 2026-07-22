"""Validate Phase 14F closure and post-Phase-14F patient evidence."""
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
STATUS_FILES = {
    "status": "backend/project_docs/PROJECT_STATUS.md",
    "readme": "frontend/README.md",
    "audit": "frontend/design_v2/PHASE_14F_BROWSER_AUDIT.md",
    "checklist": "frontend/design_v2/PHASE_14F_MANUAL_REVIEW_CHECKLIST.md",
    "evidence": "frontend/design_v2/phase14f_evidence/current_head_acceptance/EVIDENCE_INDEX.md",
}
CURRENT_REQUIREMENTS = (
    "phase 14f",
    "complete",
    "current_head_acceptance",
)
EVIDENCE_FILES = (
    "staff-dashboard-1440x900-en-light.png",
    "admin-team-setup-required-1024x900-en-dark.png",
    "doctor-active-visit-empty-768x1024-ar-light-rtl.png",
    "doctor-xray-ai-detail-768x1024-ar-light-rtl.png",
)
PATIENT_STATUS_FILES = (
    "frontend/design_v2/PATIENT_ALIGNMENT_RECORD.md",
    "frontend/design_v2/design_alignment_evidence/patients/EVIDENCE_INDEX.md",
)
PATIENT_EVIDENCE_FILES = (
    "staff-patients-directory-1440x900-en-light.png",
    "staff-patient-profile-overview-1440x900-en-light.png",
    "admin-patients-directory-1024x900-en-dark.png",
    "doctor-patients-directory-768x1024-ar-light-rtl.png",
)
PATIENT_REQUIREMENTS = (
    "stage 4",
    "patient",
    "backend changes: none",
    "migrations: none",
)
STAGE6_FILES = (
    "frontend/design_v2/DOCUMENT_AUTHORITY.md",
    "frontend/design_v2/DESIGN_ALIGNMENT_HISTORY.md",
    "frontend/design_v2/BILLING_ALIGNMENT_RECORD.md",
    "frontend/design_v2/BILLING_VISUAL_DELTA.md",
    "frontend/design_v2/design_alignment_evidence/billing/EVIDENCE_INDEX.md",
)
STAGE6_IMPLEMENTATION_SHA = "97566c0e3f79ada7ae9fe004025d2451b785779f"
STALE_CURRENT_AUTHORITY = (
    "phase 14f browser visual/uat acceptance is next",
    "phase 14f complete — blocked",
    "three high and two medium product defects",
)


def read(relative: str, errors: list[str]) -> str:
    path = ROOT / relative
    if not path.is_file():
        errors.append(f"missing {relative}")
        return ""
    return path.read_text(encoding="utf-8")


def main() -> int:
    errors: list[str] = []
    sources = {name: read(relative, errors) for name, relative in STATUS_FILES.items()}

    for name, source in sources.items():
        lowered = source.lower()
        for requirement in CURRENT_REQUIREMENTS:
            if requirement not in lowered:
                errors.append(f"{name} missing current Phase 14F fact: {requirement!r}")
        for stale in STALE_CURRENT_AUTHORITY:
            if stale in lowered:
                errors.append(f"{name} retains stale current authority: {stale!r}")

    for filename in EVIDENCE_FILES:
        if not (ROOT / "frontend/design_v2/phase14f_evidence/current_head_acceptance" / filename).is_file():
            errors.append(f"missing current-head evidence screenshot: {filename}")

    for relative in PATIENT_STATUS_FILES:
        source = read(relative, errors)
        lowered = source.lower()
        for requirement in PATIENT_REQUIREMENTS:
            if requirement not in lowered:
                errors.append(f"{relative} missing Stage 4 fact: {requirement!r}")

    patient_evidence = ROOT / "frontend/design_v2/design_alignment_evidence/patients"
    for filename in PATIENT_EVIDENCE_FILES:
        if not (patient_evidence / filename).is_file():
            errors.append(f"missing patient evidence screenshot: {filename}")

    stage6_sources = {relative: read(relative, errors) for relative in STAGE6_FILES}
    status = sources["status"].lower()
    design_status = read("frontend/design_v2/DESIGN_ALIGNMENT_STATUS.md", errors).lower()
    for requirement in ("latest completed stage: stage 6", "next stage: visits and clinical workflows"):
        if requirement not in design_status:
            errors.append(f"design alignment status missing Stage 6 snapshot fact: {requirement!r}")
    for stale in ("pending stage 1", "next stage: patient", "next recommended stage: team", "next recommended stage: billing"):
        if stale in design_status:
            errors.append(f"design alignment status retains stale marker: {stale!r}")
    if "stage 6 billing visual alignment is complete" not in status:
        errors.append("project status missing Stage 6 billing activity note")
    if "9177f5eb404b922fbac1969447767ea0e7f31dc8" in "\n".join(stage6_sources.values()).lower():
        errors.append("Stage 6 documentation retains invalid Stage 5 SHA")
    for relative, source in stage6_sources.items():
        if relative.endswith("DOCUMENT_AUTHORITY.md"):
            continue
        if STAGE6_IMPLEMENTATION_SHA not in source:
            errors.append(f"{relative} missing validated Stage 6 implementation SHA")

    if errors:
        print("Documentation consistency check failed:\n- " + "\n- ".join(errors))
        return 1
    print("Documentation consistency check passed for Phase 14F closure and Stage 4 patient evidence.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
