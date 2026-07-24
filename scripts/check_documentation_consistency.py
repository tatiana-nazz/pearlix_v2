"""Validate Phase 14F and completed medical-blue alignment closure records."""
from pathlib import Path
import re
import subprocess
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
STAGE7_FILES = (
    "frontend/design_v2/VISIT_ALIGNMENT_RECORD.md",
    "frontend/design_v2/VISIT_VISUAL_DELTA.md",
    "frontend/design_v2/DESIGN_ALIGNMENT_HISTORY.md",
    "frontend/design_v2/design_alignment_evidence/visits/EVIDENCE_INDEX.md",
    "backend/project_docs/PROJECT_STATUS.md",
)
STAGE7_IMPLEMENTATION_SHA = "1cc67e199473d662859c21c76127093f6ab555b7"
STAGE7_EVIDENCE_FILES = (
    "before/doctor-visit-history-before-1440x900-en-light.png",
    "before/doctor-visit-xrays-before-1440x900-en-light.png",
    "before/doctor-visit-appointment-before-1440x900-en-light.png",
    "before/doctor-complete-visit-before-1440x900-en-light.png",
    "before/staff-visit-readonly-before-1024x900-en-dark.png",
    "before/admin-visit-readonly-before-1024x900-en-dark.png",
    "before/doctor-visit-before-768x1024-ar-light-rtl.png",
    "before/doctor-no-active-visit-before-768x1024-en-light.png",
    "after/doctor-visit-dirty-notes-after-1440x900-en-light.png",
    "after/doctor-completed-visit-after-1440x900-en-light.png",
    "after/doctor-visit-responsive-after-768x1024-en-light.png",
)
STAGE8_FILES = (
    "frontend/design_v2/XRAY_AI_ALIGNMENT_RECORD.md",
    "frontend/design_v2/XRAY_AI_VISUAL_DELTA.md",
    "frontend/design_v2/DESIGN_ALIGNMENT_STATUS.md",
    "frontend/design_v2/DESIGN_ALIGNMENT_HISTORY.md",
    "frontend/design_v2/design_alignment_evidence/xrays-ai/EVIDENCE_INDEX.md",
    "backend/project_docs/PROJECT_STATUS.md",
)
STAGE8_IMPLEMENTATION_SHA = "5cdd84c30f7668b9710832f411230c7560d33d0e"
STAGE9_FILES = (
    "frontend/design_v2/ADMIN_SUPPORTING_ALIGNMENT_RECORD.md",
    "frontend/design_v2/ADMIN_SUPPORTING_VISUAL_DELTA.md",
    "frontend/design_v2/DESIGN_ALIGNMENT_STATUS.md",
    "frontend/design_v2/DESIGN_ALIGNMENT_HISTORY.md",
    "frontend/design_v2/design_alignment_evidence/admin-supporting/EVIDENCE_INDEX.md",
    "backend/project_docs/PROJECT_STATUS.md",
)
STAGE9_IMPLEMENTATION_SHA = "d5fe795fb291bdd50b22626b25caaf70f3f4d5e6"
STAGE9_EVIDENCE_FILES = (
    "before/admin-clinic-settings-before-1440x900-en-light.png",
    "before/admin-audit-log-before-1440x900-en-light.png",
    "after/admin-clinic-settings-after-1440x900-en-light.png",
    "after/admin-audit-log-after-1440x900-en-light.png",
    "after/admin-clinic-settings-validation-after-1440x900-en-light.png",
    "after/supporting-permission-denied-staff-after-768x1024-en-light.png",
    "after/supporting-not-found-after-768x1024-en-light.png",
)
STAGE10_AUDITED_RUNTIME_SHA = "3809cd0cc8cdeae9c3d921c3db58cb67bc6686f0"
STAGE10_FILES = (
    "frontend/design_v2/MEDICAL_BLUE_FINAL_AUDIT.md",
    "frontend/design_v2/MEDICAL_BLUE_CLOSURE_RECORD.md",
    "frontend/design_v2/DESIGN_ALIGNMENT_STATUS.md",
    "frontend/design_v2/DESIGN_ALIGNMENT_HISTORY.md",
    "frontend/design_v2/design_alignment_evidence/final-audit/EVIDENCE_INDEX.md",
    "backend/project_docs/PROJECT_STATUS.md",
)
STAGE10_EVIDENCE_FILES = (
    "admin/admin-dashboard-final-1440x900-en-light.png",
    "staff/staff-dashboard-final-1440x900-en-light.png",
    "doctor/doctor-dashboard-final-1440x900-en-light.png",
    "shared-states/access-denied-final-768x1024-en-light.png",
    "shared-states/not-found-final-768x1024-en-light.png",
    "shared-states/representative-empty-final-768x1024-en-light.png",
    "corrections/doctor-xray-canvas-before-1440x900-en-light.png",
    "corrections/doctor-xray-canvas-after-1440x900-en-light.png",
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

    stage6_sources = {relative: read(relative, errors) for relative in STAGE6_FILES}
    status = sources["status"].lower()
    design_status = read("frontend/design_v2/DESIGN_ALIGNMENT_STATUS.md", errors).lower()
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

    stage7_sources = {relative: read(relative, errors) for relative in STAGE7_FILES}
    for relative, source in stage7_sources.items():
        if STAGE7_IMPLEMENTATION_SHA not in source:
            errors.append(f"{relative} missing validated Stage 7 implementation SHA")
    stage8_sources = {relative: read(relative, errors) for relative in STAGE8_FILES}
    for relative, source in stage8_sources.items():
        if STAGE8_IMPLEMENTATION_SHA not in source:
            errors.append(f"{relative} missing validated Stage 8 implementation SHA")
    stage8_status = stage8_sources["frontend/design_v2/DESIGN_ALIGNMENT_STATUS.md"].lower()
    if "latest completed stage: stage 8 x-rays and ai" in stage8_status or "next stage: remaining admin and supporting screens" in stage8_status:
        errors.append("design alignment status retains stale Stage 8 current-status wording")
    stage7_text = "\n".join(stage7_sources.values()).lower()
    for stale in ("pending implementation", "pending verification", "pending finalization", "implementation commit: pending", "next stage: visits", "next stage: billing"):
        if stale in stage7_text:
            errors.append(f"Stage 7 documentation retains stale marker: {stale!r}")
    if "9177f5eb404b922fbac1969447767ea0e7f31dc8" in stage7_text:
        errors.append("Stage 7 documentation retains invalid Stage 5 SHA")
    stage7_evidence = ROOT / "frontend/design_v2/design_alignment_evidence/visits"
    for filename in STAGE7_EVIDENCE_FILES:
        if not (stage7_evidence / filename).is_file():
            errors.append(f"missing Stage 7 evidence screenshot: {filename}")

    stage9_sources = {relative: read(relative, errors) for relative in STAGE9_FILES}
    for relative, source in stage9_sources.items():
        if STAGE9_IMPLEMENTATION_SHA not in source:
            errors.append(f"{relative} missing validated Stage 9 implementation SHA")
    stage9_status = stage9_sources["frontend/design_v2/DESIGN_ALIGNMENT_STATUS.md"].lower()
    if "latest completed stage: stage 10 final audit and closure" not in stage9_status:
        errors.append("design alignment status does not identify Stage 10 as latest completed stage")
    if stage9_status.count("next stage:") != 1 or "no further medical-blue stage" not in stage9_status:
        errors.append("design alignment status must contain exactly one closed-state next-stage statement")
    stage9_text = "\n".join(stage9_sources.values()).lower()
    for stale in ("pending implementation", "pending verification", "pending finalization", "implementation commit: pending", "next stage: admin", "next stage: x-rays", "next stage: visits", "9177f5eb404b922fbac1969447767ea0e7f31dc8"):
        if stale in stage9_text:
            errors.append(f"Stage 9 documentation retains stale marker: {stale!r}")
    stage9_evidence = ROOT / "frontend/design_v2/design_alignment_evidence/admin-supporting"
    for filename in STAGE9_EVIDENCE_FILES:
        if not (stage9_evidence / filename).is_file():
            errors.append(f"missing Stage 9 evidence screenshot: {filename}")

    stage10_sources = {relative: read(relative, errors) for relative in STAGE10_FILES}
    for relative, source in stage10_sources.items():
        if STAGE10_AUDITED_RUNTIME_SHA not in source:
            errors.append(f"{relative} missing audited runtime SHA")
    final_audit = stage10_sources["frontend/design_v2/MEDICAL_BLUE_FINAL_AUDIT.md"].lower()
    closure = stage10_sources["frontend/design_v2/MEDICAL_BLUE_CLOSURE_RECORD.md"].lower()
    if "route closure inventory" not in final_audit or "initiative is complete" not in final_audit:
        errors.append("final audit is missing route closure or initiative-complete result")
    if "final closure verdict: **complete**" not in closure:
        errors.append("closure record does not contain a complete verdict")
    if "medical-blue alignment initiative is complete" not in stage9_status:
        errors.append("design alignment status does not mark the initiative complete")
    evidence_root = ROOT / "frontend/design_v2/design_alignment_evidence/final-audit"
    for filename in STAGE10_EVIDENCE_FILES:
        if not (evidence_root / filename).is_file():
            errors.append(f"missing Stage 10 evidence screenshot: {filename}")
    stage10_text = "\n".join(stage10_sources.values()).lower()
    for stale in ("pending implementation", "pending verification", "pending finalization", "implementation commit: pending", "correction sha: pending", "audit pending", "closure pending", "next stage: final medical-blue audit", "next stage: admin", "next stage: x-rays", "next stage: visits", "9177f5eb404b922fbac1969447767ea0e7f31dc8"):
        if stale in stage10_text:
            errors.append(f"Stage 10 documentation retains stale marker: {stale!r}")
    if any(token in stage10_text for token in ("â€”", "â€™", "â€œ", "â€")):
        errors.append("Stage 10 closure documentation contains mojibake")
    history = stage10_sources["frontend/design_v2/DESIGN_ALIGNMENT_HISTORY.md"]
    documented_shas = re.findall(r"`([0-9a-f]{40})`", history + "\n" + closure)
    required_shas = ("690230b623ad988093c8a338715bc20f140b97ae", "81c45696ed055ec62a9a44c0fc93b37f5f5079a4", "a3dd5b20234fc22ebdd44729e7cd81c4a11ebc41", "2e2309cc278a86bceaa78d2da3166fb12c127231", "9177f5ea46f9779de762c7776b6b443c293d77bd", STAGE6_IMPLEMENTATION_SHA, STAGE7_IMPLEMENTATION_SHA, STAGE8_IMPLEMENTATION_SHA, STAGE9_IMPLEMENTATION_SHA, STAGE10_AUDITED_RUNTIME_SHA)
    for sha in required_shas:
        if sha not in documented_shas:
            errors.append(f"SHA table omits {sha}")
        if not re.fullmatch(r"[0-9a-f]{40}", sha):
            errors.append(f"SHA is not full length: {sha}")
        resolved = subprocess.run(["git", "cat-file", "-e", f"{sha}^{{commit}}"], cwd=ROOT, capture_output=True, text=True)
        if resolved.returncode != 0:
            errors.append(f"documented SHA does not resolve: {sha}")

    if errors:
        print("Documentation consistency check failed:\n- " + "\n- ".join(errors))
        return 1
    print("Documentation consistency check passed for Phase 14F and Stage 10 medical-blue closure.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
