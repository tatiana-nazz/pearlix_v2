from __future__ import annotations

import json

from apps.xrays.image_validation import MAX_UPLOAD_BYTES


# The image itself is capped at 10 MiB. Multipart headers and the small title/
# notes fields receive a fixed allowance, while the complete HTTP request stays
# bounded before a framework multipart parser can materialize it.
MAX_XRAY_MULTIPART_BODY_BYTES = MAX_UPLOAD_BYTES + (512 * 1024)


class RequestBodyTooLarge(Exception):
    pass


def declared_content_length(headers) -> int | None:
    """Return a validated Content-Length from WSGI/ASGI-style headers."""

    if headers is None:
        return None
    if isinstance(headers, dict):
        raw = headers.get("CONTENT_LENGTH") or headers.get("content-length")
    else:
        raw = None
        for key, value in headers:
            if bytes(key).lower() == b"content-length":
                raw = bytes(value).decode("ascii", errors="strict")
                break
    if raw in (None, ""):
        return None
    try:
        value = int(raw)
    except (TypeError, ValueError, UnicodeError) as exc:
        raise RequestBodyTooLarge("The request Content-Length is invalid.") from exc
    if value < 0:
        raise RequestBodyTooLarge("The request Content-Length is invalid.")
    return value


class BoundedASGIRequestBodyMiddleware:
    """Bound selected ASGI request bodies before multipart parsing occurs."""

    def __init__(self, app, *, maximum_bytes: int = MAX_XRAY_MULTIPART_BODY_BYTES, paths=("/analyze",)):
        self.app = app
        self.maximum_bytes = int(maximum_bytes)
        self.paths = frozenset(paths)

    async def __call__(self, scope, receive, send):
        if scope.get("type") != "http" or scope.get("path") not in self.paths:
            await self.app(scope, receive, send)
            return

        try:
            length = declared_content_length(scope.get("headers", ()))
        except RequestBodyTooLarge:
            await self._reject(send)
            return
        if length is not None and length > self.maximum_bytes:
            await self._reject(send)
            return

        consumed = 0

        async def limited_receive():
            nonlocal consumed
            message = await receive()
            if message.get("type") == "http.request":
                consumed += len(message.get("body", b""))
                if consumed > self.maximum_bytes:
                    raise RequestBodyTooLarge("The request body exceeded the allowed size.")
            return message

        try:
            await self.app(scope, limited_receive, send)
        except RequestBodyTooLarge:
            # Multipart parsing happens before the endpoint sends its response,
            # so a size failure here is still safe to turn into a bounded 413.
            await self._reject(send)

    async def _reject(self, send):
        body = json.dumps(
            {"detail": "The X-ray upload request exceeds the allowed size."},
            separators=(",", ":"),
        ).encode("utf-8")
        await send(
            {
                "type": "http.response.start",
                "status": 413,
                "headers": [
                    (b"content-type", b"application/json"),
                    (b"content-length", str(len(body)).encode("ascii")),
                ],
            }
        )
        await send({"type": "http.response.body", "body": body})
