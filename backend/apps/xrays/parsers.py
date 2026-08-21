from __future__ import annotations

from rest_framework.exceptions import APIException
from rest_framework.parsers import MultiPartParser

from apps.xrays.image_validation import MAX_UPLOAD_BYTES


# The encoded image itself is limited to 10 MiB. Allow a small, fixed amount
# of multipart/form metadata while still bounding the complete request body
# before Django/DRF materializes it.
MAX_XRAY_MULTIPART_BODY_BYTES = MAX_UPLOAD_BYTES + (512 * 1024)


class XrayRequestTooLarge(APIException):
    status_code = 413
    default_detail = "The X-ray upload request exceeds the allowed size."
    default_code = "request_body_too_large"


class _BoundedStream:
    """Read-through wrapper that hard-stops once the request byte cap is hit."""

    def __init__(self, stream, maximum_bytes: int):
        self._stream = stream
        self._maximum_bytes = int(maximum_bytes)
        self._consumed = 0

    def _read(self, reader, size=-1):
        remaining = self._maximum_bytes - self._consumed
        if remaining < 0:
            raise XrayRequestTooLarge()

        # Read at most one byte beyond the remaining allowance so a missing or
        # dishonest Content-Length cannot bypass the body cap.
        probe = remaining + 1
        if size is None or size < 0 or size > probe:
            size = probe
        data = reader(size)
        if data is None:
            data = b""
        if len(data) > remaining:
            raise XrayRequestTooLarge()
        self._consumed += len(data)
        return data

    def read(self, size=-1):
        return self._read(self._stream.read, size)

    def readline(self, size=-1):
        return self._read(self._stream.readline, size)

    def __iter__(self):
        return self

    def __next__(self):
        line = self.readline()
        if not line:
            raise StopIteration
        return line

    def __getattr__(self, name):
        return getattr(self._stream, name)


class BoundedXrayMultiPartParser(MultiPartParser):
    """Multipart parser with a pre-materialization whole-request byte limit."""

    body_limit = MAX_XRAY_MULTIPART_BODY_BYTES

    def parse(self, stream, media_type=None, parser_context=None):
        parser_context = parser_context or {}
        request = parser_context.get("request")
        if request is not None:
            raw_length = request.META.get("CONTENT_LENGTH")
            if raw_length not in (None, ""):
                try:
                    declared_length = int(raw_length)
                except (TypeError, ValueError) as exc:
                    raise XrayRequestTooLarge() from exc
                if declared_length < 0 or declared_length > self.body_limit:
                    raise XrayRequestTooLarge()

        bounded_stream = _BoundedStream(stream, self.body_limit)
        return super().parse(
            bounded_stream,
            media_type=media_type,
            parser_context=parser_context,
        )
