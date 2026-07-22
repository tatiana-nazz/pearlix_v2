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

    if errors:
        print("Documentation consistency check failed:\n- " + "\n- ".join(errors))
        return 1
    print("Documentation consistency check passed for Phase 14F closure and Stage 4 patient evidence.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
