from __future__ import annotations

from rest_framework.exceptions import ErrorDetail
from rest_framework.views import exception_handler

from apps.common.errors import error_payload


def _stringify_errors(value):
    if isinstance(value, ErrorDetail):
        return str(value)
    if isinstance(value, list):
        return [_stringify_errors(item) for item in value]
    if isinstance(value, dict):
        return {key: _stringify_errors(item) for key, item in value.items()}
    return value


def standard_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is None:
        return None

    details = _stringify_errors(response.data)
    default_code = getattr(exc, "default_code", "error")
    code = str(default_code).upper()
    if code == "NOT_AUTHENTICATED":
        code = "AUTH_REQUIRED"
    elif response.status_code == 404:
        code = "NOT_FOUND"
    elif response.status_code == 400:
        code = "VALIDATION_ERROR"

    if isinstance(details, dict) and "detail" in details and len(details) == 1:
        message = str(details["detail"])
        details = {}
    else:
        message = "Some fields are invalid." if response.status_code == 400 else "Request failed."

    response.data = error_payload(code=code, message=message, details=details)
    return response
