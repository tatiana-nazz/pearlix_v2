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
