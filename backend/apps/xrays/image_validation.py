from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from threading import BoundedSemaphore
import warnings

from PIL import Image, UnidentifiedImageError


# Panoramic radiographs are wide, but larger decoded surfaces are not useful
# to Pearlix and can exhaust an inference worker.
MAX_UPLOAD_BYTES = 10 * 1024 * 1024
MAX_IMAGE_WIDTH = 12_000
MAX_IMAGE_HEIGHT = 12_000
MAX_IMAGE_PIXELS = 40_000_000
MAX_DECODED_BYTES = 160_000_000
MAX_IMAGE_FRAMES = 1
FORMAT_EXTENSIONS = {"PNG": {".png"}, "JPEG": {".jpg", ".jpeg"}}
FORMAT_CONTENT_TYPES = {"PNG": "image/png", "JPEG": "image/jpeg"}

# Decoded-image memory is process-local, so the admission guard belongs to the
# worker that will allocate it. One decode at a time prevents two worst-case
# 160 MB decoded surfaces from being materialized concurrently in one Vercel/
# Django worker while still allowing independent serverless workers to scale.
_IMAGE_DECODE_SLOT = BoundedSemaphore(value=1)


class ImageValidationError(ValueError):
    pass


@dataclass(frozen=True)
class ValidatedImage:
    content: bytes
    format: str
    extension: str
    content_type: str
    width: int
    height: int
    original_file_name: str

    @property
    def size_bytes(self) -> int:
        return len(self.content)


def safe_basename(name: str) -> str:
    value = str(name or "").replace("\\", "/").split("/")[-1]
    if not value or value in {".", ".."} or any(ord(char) < 32 for char in value):
        raise ImageValidationError("The filename is invalid.")
    return value[:255]


def _read_bounded(uploaded_file, maximum: int) -> bytes:
    try:
        uploaded_file.seek(0)
    except (AttributeError, OSError):
        pass
    content = uploaded_file.read(maximum + 1)
    try:
        uploaded_file.seek(0)
    except (AttributeError, OSError):
        pass
    if not content:
        raise ImageValidationError("The image is empty.")
    if len(content) > maximum:
        raise ImageValidationError("The image exceeds the encoded byte limit.")
    return bytes(content)


def validate_image_upload(uploaded_file, *, require_png: bool = False, maximum_bytes: int = MAX_UPLOAD_BYTES) -> ValidatedImage:
    if uploaded_file is None:
        raise ImageValidationError("An image file is required.")
    original_name = safe_basename(getattr(uploaded_file, "name", ""))
    extension = Path(original_name).suffix.lower()
    content = _read_bounded(uploaded_file, maximum_bytes)

    with _IMAGE_DECODE_SLOT:
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("error", Image.DecompressionBombWarning)
                with Image.open(BytesIO(content)) as image:
                    actual_format = str(image.format or "").upper()
                    width, height = image.size
                    frames = int(getattr(image, "n_frames", 1))
                    if actual_format not in FORMAT_EXTENSIONS or (require_png and actual_format != "PNG"):
                        raise ImageValidationError("Only PNG and JPEG images are supported.")
                    if extension not in FORMAT_EXTENSIONS[actual_format]:
                        raise ImageValidationError("The filename extension does not match the image format.")
                    declared_type = str(getattr(uploaded_file, "content_type", "") or "").lower()
                    if declared_type != FORMAT_CONTENT_TYPES[actual_format]:
                        raise ImageValidationError("The declared content type does not match the image format.")
                    if frames != MAX_IMAGE_FRAMES:
                        raise ImageValidationError("Multi-frame images are not supported.")
                    pixels = width * height
                    if width <= 0 or height <= 0 or width > MAX_IMAGE_WIDTH or height > MAX_IMAGE_HEIGHT:
                        raise ImageValidationError("The image dimensions exceed the supported limit.")
                    if pixels > MAX_IMAGE_PIXELS or pixels * 4 > MAX_DECODED_BYTES:
                        raise ImageValidationError("The decoded image surface exceeds the supported limit.")
                    image.verify()
                with Image.open(BytesIO(content)) as decoded:
                    decoded.load()
        except (ImageValidationError, Image.DecompressionBombWarning):
            raise
        except (UnidentifiedImageError, OSError, SyntaxError, ValueError) as exc:
            raise ImageValidationError("The image payload is malformed or truncated.") from exc

    return ValidatedImage(
        content=content,
        format=actual_format,
        extension=".png" if actual_format == "PNG" else ".jpg",
        content_type=FORMAT_CONTENT_TYPES[actual_format],
        width=width,
        height=height,
        original_file_name=original_name,
    )
