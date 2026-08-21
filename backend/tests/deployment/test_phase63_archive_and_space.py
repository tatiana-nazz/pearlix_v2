from __future__ import annotations

import importlib.util
import zipfile
from pathlib import Path

import pytest

from deployment import archive_safety
from deployment.archive_safety import extract_zip_safely
from deployment.publish_hf_ai import build_space, validate_space_build


def _archive(path: Path, entries, *, compression=zipfile.ZIP_DEFLATED):
    with zipfile.ZipFile(path, "w", compression=compression) as archive:
        for name, content in entries:
            archive.writestr(name, content)


def test_valid_bundle_extracts_streamingly(tmp_path):
    source = tmp_path / "bundle.zip"
    _archive(source, [("weights/model.pt", b"weights"), ("contract/map.json", b"{}")])
    output = tmp_path / "output"
    output.mkdir()
    with zipfile.ZipFile(source) as archive:
        extract_zip_safely(archive, output)
    assert (output / "weights/model.pt").read_bytes() == b"weights"


@pytest.mark.parametrize(
    ("limit_name", "limit", "entries"),
    [
        ("MAX_ZIP_MEMBERS", 1, [("one", b"1"), ("two", b"2")]),
        ("MAX_SINGLE_MEMBER_UNCOMPRESSED_BYTES", 3, [("large", b"1234")]),
        ("MAX_TOTAL_UNCOMPRESSED_BYTES", 5, [("one", b"123"), ("two", b"456")]),
        ("MAX_COMPRESSION_RATIO", 2, [("bomb", b"0" * 10_000)]),
    ],
)
def test_archive_metadata_limits_reject_before_extraction(tmp_path, monkeypatch, limit_name, limit, entries):
    monkeypatch.setattr(archive_safety, limit_name, limit)
    source = tmp_path / "bundle.zip"
    _archive(source, entries)
    output = tmp_path / "output"
    output.mkdir()
    with zipfile.ZipFile(source) as archive, pytest.raises(SystemExit, match="unsafe"):
        extract_zip_safely(archive, output)
    assert list(output.rglob("*")) == []


@pytest.mark.parametrize("name", ["../escape", "/absolute", "C:/drive", "safe", "SAFE"])
def test_archive_rejects_traversal_drive_and_duplicate_targets(tmp_path, name):
    entries = [(name, b"x")]
    if name == "safe":
        entries.append(("SAFE", b"y"))
    elif name == "SAFE":
        entries.insert(0, ("safe", b"y"))
    source = tmp_path / "bundle.zip"
    _archive(source, entries)
    output = tmp_path / "output"
    output.mkdir()
    with zipfile.ZipFile(source) as archive, pytest.raises(SystemExit, match="unsafe"):
        extract_zip_safely(archive, output)
    assert list(output.rglob("*")) == []


def test_archive_rejects_symlink_and_corrupt_stream(tmp_path):
    symlink_zip = tmp_path / "symlink.zip"
    info = zipfile.ZipInfo("link")
    info.external_attr = (0o120777 << 16)
    with zipfile.ZipFile(symlink_zip, "w") as archive:
        archive.writestr(info, "target")
    output = tmp_path / "output"
    output.mkdir()
    with zipfile.ZipFile(symlink_zip) as archive, pytest.raises(SystemExit, match="unsafe"):
        extract_zip_safely(archive, output)

    corrupt = tmp_path / "corrupt.zip"
    _archive(corrupt, [("file", b"content")])
    corrupt.write_bytes(corrupt.read_bytes()[:-12])
    with pytest.raises((zipfile.BadZipFile, SystemExit)):
        with zipfile.ZipFile(corrupt) as archive:
            extract_zip_safely(archive, output)


def test_generated_space_packages_xray_validator_and_imports_without_repo_path(tmp_path):
    repo_root = Path(__file__).resolve().parents[3]
    output = tmp_path / "space"
    build_space(repo_root, output)
    validate_space_build(output)
    assert (output / "apps/xrays/image_validation.py").is_file()
