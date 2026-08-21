from __future__ import annotations

import ntpath
import stat
import zipfile
from pathlib import Path, PurePosixPath


MAX_ZIP_MEMBERS = 512
MAX_SINGLE_MEMBER_UNCOMPRESSED_BYTES = 2 * 1024 * 1024 * 1024
MAX_TOTAL_UNCOMPRESSED_BYTES = 4 * 1024 * 1024 * 1024
MAX_COMPRESSION_RATIO = 200
COPY_CHUNK_BYTES = 1024 * 1024


def _fail(reason: str) -> None:
    raise SystemExit(f"Bundle ZIP contains an unsafe member path or payload: {reason}.")


def _validated_members(archive: zipfile.ZipFile, destination: Path):
    members = archive.infolist()
    if len(members) > MAX_ZIP_MEMBERS:
        _fail("too many archive members")
    destination = destination.resolve()
    seen: set[str] = set()
    declared_total = 0
    validated = []
    for member in members:
        name = member.filename.replace("\\", "/")
        parts = PurePosixPath(name).parts
        if (
            not name
            or name.startswith("/")
            or ntpath.splitdrive(name)[0]
            or ".." in parts
            or member.flag_bits & 0x1
        ):
            _fail("invalid member path or flags")
        target = (destination / Path(*parts)).resolve()
        if not target.is_relative_to(destination):
            _fail("member escapes the extraction directory")
        normalized = "/".join(parts).rstrip("/")
        if not normalized or normalized.casefold() in seen:
            _fail("duplicate or empty member target")
        seen.add(normalized.casefold())

        mode = member.external_attr >> 16
        file_type = stat.S_IFMT(mode)
        if file_type and not (stat.S_ISREG(mode) or stat.S_ISDIR(mode)):
            _fail("special file member")
        if member.file_size > MAX_SINGLE_MEMBER_UNCOMPRESSED_BYTES:
            _fail("member exceeds the uncompressed size limit")
        declared_total += member.file_size
        if declared_total > MAX_TOTAL_UNCOMPRESSED_BYTES:
            _fail("archive exceeds the cumulative uncompressed size limit")
        if member.file_size and member.file_size / max(1, member.compress_size) > MAX_COMPRESSION_RATIO:
            _fail("member exceeds the compression-ratio limit")
        validated.append((member, target))
    return validated


def extract_zip_safely(archive: zipfile.ZipFile, destination: Path) -> None:
    """Preflight metadata, then stream a ZIP into a bounded destination."""
    validated = _validated_members(archive, destination)
    actual_total = 0
    for member, target in validated:
        if member.is_dir():
            target.mkdir(parents=True, exist_ok=True)
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        member_total = 0
        try:
            with archive.open(member, "r") as source, target.open("xb") as output:
                while chunk := source.read(COPY_CHUNK_BYTES):
                    member_total += len(chunk)
                    actual_total += len(chunk)
                    if member_total > MAX_SINGLE_MEMBER_UNCOMPRESSED_BYTES:
                        _fail("member expanded beyond its size limit")
                    if actual_total > MAX_TOTAL_UNCOMPRESSED_BYTES:
                        _fail("archive expanded beyond its cumulative size limit")
                    output.write(chunk)
        except (RuntimeError, zipfile.BadZipFile, OSError) as exc:
            target.unlink(missing_ok=True)
            raise SystemExit("Bundle ZIP is corrupt or could not be extracted safely.") from exc
        if member_total != member.file_size:
            target.unlink(missing_ok=True)
            _fail("member size differs from ZIP metadata")
