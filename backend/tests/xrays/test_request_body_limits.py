import asyncio
from io import BytesIO
from types import SimpleNamespace

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from rest_framework.settings import api_settings

from apps.xrays.image_validation import validate_image_upload
from apps.xrays.parsers import (
    BoundedXrayMultiPartParser,
    MAX_XRAY_MULTIPART_BODY_BYTES,
    XrayRequestTooLarge,
    _BoundedStream,
)
from apps.xrays.request_limits import BoundedASGIRequestBodyMiddleware


def _png_bytes():
    output = BytesIO()
    Image.new("L", (32, 16), 100).save(output, format="PNG")
    return output.getvalue()


def test_bounded_multipart_parser_is_the_default_for_multipart_requests():
    assert BoundedXrayMultiPartParser in api_settings.DEFAULT_PARSER_CLASSES


def test_declared_oversized_multipart_is_rejected_before_stream_read():
    class NeverRead(BytesIO):
        def read(self, *_args, **_kwargs):
            raise AssertionError("oversized declared request must be rejected before reading")

    parser = BoundedXrayMultiPartParser()
    request = SimpleNamespace(META={"CONTENT_LENGTH": str(MAX_XRAY_MULTIPART_BODY_BYTES + 1)})

    with pytest.raises(XrayRequestTooLarge):
        parser.parse(
            NeverRead(b""),
            media_type="multipart/form-data; boundary=pearlix",
            parser_context={"request": request},
        )


def test_bounded_stream_rejects_unknown_length_body_once_limit_is_crossed():
    stream = _BoundedStream(BytesIO(b"abcdef"), 5)
    assert stream.read(5) == b"abcde"
    with pytest.raises(XrayRequestTooLarge):
        stream.read(1)


def test_asgi_limit_rejects_declared_oversize_before_downstream_parser_runs():
    called = {"app": False, "receive": False}
    sent = []

    async def app(_scope, _receive, _send):
        called["app"] = True

    async def receive():
        called["receive"] = True
        return {"type": "http.request", "body": b"", "more_body": False}

    async def send(message):
        sent.append(message)

    middleware = BoundedASGIRequestBodyMiddleware(app, maximum_bytes=5)
    scope = {
        "type": "http",
        "path": "/analyze",
        "headers": [(b"content-length", b"6")],
    }
    asyncio.run(middleware(scope, receive, send))

    assert called == {"app": False, "receive": False}
    assert sent[0]["status"] == 413


def test_asgi_limit_rejects_chunked_body_before_endpoint_receives_oversize():
    sent = []
    chunks = iter(
        [
            {"type": "http.request", "body": b"abc", "more_body": True},
            {"type": "http.request", "body": b"def", "more_body": False},
        ]
    )

    async def receive():
        return next(chunks)

    async def send(message):
        sent.append(message)

    async def parsing_app(_scope, bounded_receive, _send):
        first = await bounded_receive()
        assert first["body"] == b"abc"
        await bounded_receive()
        raise AssertionError("oversized body should not reach endpoint logic")

    middleware = BoundedASGIRequestBodyMiddleware(parsing_app, maximum_bytes=5)
    scope = {"type": "http", "path": "/analyze", "headers": []}
    asyncio.run(middleware(scope, receive, send))

    assert sent[0]["status"] == 413


def test_asgi_limit_does_not_interfere_with_other_routes():
    observed = {"called": False}

    async def app(_scope, receive, send):
        observed["called"] = True
        await receive()
        await send({"type": "http.response.start", "status": 204, "headers": []})
        await send({"type": "http.response.body", "body": b""})

    async def receive():
        return {"type": "http.request", "body": b"abcdef", "more_body": False}

    sent = []

    async def send(message):
        sent.append(message)

    middleware = BoundedASGIRequestBodyMiddleware(app, maximum_bytes=5)
    scope = {"type": "http", "path": "/health", "headers": []}
    asyncio.run(middleware(scope, receive, send))

    assert observed["called"] is True
    assert sent[0]["status"] == 204


def test_image_validation_uses_process_local_decode_admission(monkeypatch):
    import apps.xrays.image_validation as image_validation

    entered = {"count": 0}

    class Guard:
        def __enter__(self):
            entered["count"] += 1
            return self

        def __exit__(self, *_args):
            return False

    monkeypatch.setattr(image_validation, "_IMAGE_DECODE_SLOT", Guard())
    validate_image_upload(
        SimpleUploadedFile("probe.png", _png_bytes(), content_type="image/png")
    )
    assert entered["count"] == 1
