from __future__ import annotations

from collections.abc import Mapping

from apps.audit.models import ActivityLog


SENSITIVE_KEY_PARTS = {
    "access",
    "authorization",
    "clinical_notes",
    "diagnosis",
    "file",
    "follow_up_notes",
    "password",
    "path",
    "raw",
    "refresh",
    "secret",
    "symptoms",
    "token",
    "treatment",
}


def _safe_metadata(value):
    if isinstance(value, Mapping):
        clean = {}
        for key, item in value.items():
            key_text = str(key)
            lowered = key_text.lower()
            if any(part in lowered for part in SENSITIVE_KEY_PARTS):
                continue
            clean[key_text] = _safe_metadata(item)
        return clean
    if isinstance(value, list | tuple):
        return [_safe_metadata(item) for item in value]
    return value


def _request_ip(request):
    if request is None:
        return None
    forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded_for:
        return forwarded_for.split(",", 1)[0].strip() or None
    return request.META.get("REMOTE_ADDR") or None


def log_activity(
    *,
    request=None,
    actor=None,
    action: str,
    entity_type: str,
    entity_id=None,
    metadata: dict | None = None,
) -> None:
    try:
        actor = actor or getattr(request, "user", None)
        if actor is not None and not getattr(actor, "is_authenticated", False):
            actor = None
        user_agent = ""
        if request is not None:
            user_agent = (request.META.get("HTTP_USER_AGENT") or "")[:255]
        ActivityLog.objects.create(
            actor=actor,
            actor_role=getattr(actor, "role", "") if actor else "",
            action=action,
            entity_type=entity_type,
            entity_id="" if entity_id is None else str(entity_id),
            metadata_json=_safe_metadata(metadata or {}),
            ip_address=_request_ip(request),
            user_agent=user_agent,
        )
    except Exception:
        return
