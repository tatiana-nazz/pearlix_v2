from pathlib import Path

from django.http import FileResponse
from django.utils.text import get_valid_filename
from rest_framework import status

from apps.common.errors import error_response


def protected_file_response(file_field, *, content_type: str, filename: str, not_found_message: str):
    if not file_field:
        return error_response("NOT_FOUND", not_found_message, status_code=status.HTTP_404_NOT_FOUND)

    safe_name = get_valid_filename(Path(filename or "download").name) or "download"
    try:
        file_handle = file_field.open("rb")
    except (FileNotFoundError, OSError, ValueError):
        return error_response("NOT_FOUND", not_found_message, status_code=status.HTTP_404_NOT_FOUND)

    response = FileResponse(file_handle, content_type=content_type or "application/octet-stream")
    response["Content-Disposition"] = f'inline; filename="{safe_name}"'
    response["Cache-Control"] = "no-store"
    response["Pragma"] = "no-cache"
    response["X-Content-Type-Options"] = "nosniff"
    return response
