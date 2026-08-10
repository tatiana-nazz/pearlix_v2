"""Validate the registered Pearlix documentation authority chain without brittle prose checks."""

from pathlib import Path
import re
import sys


ROOT = Path(__file__).resolve().parents[1]
FILES = {
    "start": "CODEX_START_HERE.md",
    "register": "backend/project_docs/DOCUMENT_AUTHORITY_REGISTER.md",
    "status": "backend/project_docs/PROJECT_STATUS.md",
    "backend_decisions": "backend/project_docs/CURRENT_BACKEND_DECISIONS.md",
    "ai_deployment": "backend/project_docs/AI_MODEL_DEPLOYMENT.md",
    "audit": "backend/project_docs/FRONTEND_BACKEND_INTEGRATION_AUDIT.md",
    "backend_phase_tracker": "backend/project_docs/BACKEND_PHASE_TRACKER.md",
    "ui": "frontend/CURRENT_PRODUCT_UI_SOURCE_OF_TRUTH.md",
    "frontend_readme": "frontend/README.md",
    "backend_readme": "backend/README.md",
    "legacy_design": "frontend/design/DESIGN_SYSTEM.md",
    "legacy_sequence": "frontend/design_v2/IMPLEMENTATION_SEQUENCE.md",
    "legacy_handoff": "_codex_backend_handoff/00_CODEX_START_HERE.md",
    "local_login_record": "frontend/design_v2/LOCAL_LOGIN_NETWORK_FIX_RECORD.md",
}
CANONICAL = ("status", "backend_decisions", "ai_deployment", "ui")
SUPPORTING = ("audit", "backend_phase_tracker", "frontend_readme", "backend_readme")
LEGACY = ("legacy_design", "legacy_sequence", "legacy_handoff")
BASELINE = "e54a858"
HISTORICAL_HEADER = "historical / superseded"


def read_documents() -> tuple[dict[str, str], list[str]]:
    errors, text = [], {}
    for key, relative in FILES.items():
        path = ROOT / relative
        if not path.is_file():
            errors.append(f"missing {relative}")
        else:
            text[key] = path.read_text(encoding="utf-8").lower()
    return text, errors


def requires(text: dict[str, str], key: str, *phrases: str) -> list[str]:
    return [f"{FILES[key]} missing {phrase!r}" for phrase in phrases if phrase.lower() not in text.get(key, "")]


def global_claims_outside_register() -> list[str]:
    """Reject new global source-of-truth claims unless a registered marker owns them."""
    allowed = {
        "CODEX_START_HERE.md",
        "backend/project_docs/DOCUMENT_AUTHORITY_REGISTER.md",
        "backend/project_docs/PROJECT_STATUS.md",
        "backend/project_docs/CURRENT_BACKEND_DECISIONS.md",
        "backend/project_docs/AI_MODEL_DEPLOYMENT.md",
        "frontend/CURRENT_PRODUCT_UI_SOURCE_OF_TRUTH.md",
    }
    errors = []
    for path in ROOT.rglob("*.md"):
        relative = path.relative_to(ROOT).as_posix()
        if relative in allowed or any(part in {"node_modules", ".venv", ".git"} for part in path.parts):
            continue
        body = path.read_text(encoding="utf-8", errors="ignore").lower()
        if "source of truth" not in body:
            continue
        if HISTORICAL_HEADER in body[:800] or "not product/role authority" in body[:800] or "supporting" in body[:800]:
            continue
        if re.search(r"(?:the |this )?(?:current |project )?source of truth", body):
            errors.append(f"unregistered global authority claim: {relative}")
    return errors


def main() -> int:
    text, errors = read_documents()
    if errors:
        print("Documentation consistency check failed:\n- " + "\n- ".join(errors))
        return 1

    errors.extend(requires(text, "start", "mandatory first read", "authority order", "preview-pre-v2-ui", "bdd5f6f"))
    errors.extend(requires(text, "register", "current_canonical_authority_register", "frontend_complete_ui_ux_source_of_truth.md", "all active/non-archived"))
    errors.extend(requires(text, "ui", "current_canonical_product_ui", "team and users & access", "action-button treatment", "not an authorization to restore"))

    for key in CANONICAL + SUPPORTING:
        errors.extend(requires(text, key, "codex_start_here.md"))
    for key in LEGACY:
        errors.extend(requires(text, key, HISTORICAL_HEADER, "document_authority_register.md"))

    for key in ("start", "status", "backend_decisions", "audit", "ui", "frontend_readme", "backend_readme"):
        errors.extend(requires(text, key, BASELINE, "preview-pre-v2-ui"))
    for key in ("start", "status", "backend_decisions", "audit", "ui", "frontend_readme", "backend_readme", "backend_phase_tracker"):
        errors.extend(requires(text, key, "team and users & access"))

    for key in ("start", "backend_decisions", "audit", "ui", "frontend_readme", "backend_phase_tracker"):
        errors.extend(requires(text, key, "active", "non-archived"))

    forbidden_scope = "doctors can only access scoped patients"
    for key in CANONICAL + SUPPORTING:
        if forbidden_scope in text[key]:
            errors.append(f"stale narrow Doctor authorization in {FILES[key]}")
    for key in ("start", "status", "ui", "frontend_readme"):
        if "restore the pre-v2" in text[key] and "not" not in text[key]:
            errors.append(f"possible pre-v2 restoration instruction in {FILES[key]}")

    errors.extend(global_claims_outside_register())
    if errors:
        print("Documentation consistency check failed:\n- " + "\n- ".join(errors))
        return 1
    print("Documentation consistency check passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
