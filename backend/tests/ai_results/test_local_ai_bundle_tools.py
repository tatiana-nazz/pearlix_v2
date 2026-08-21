import importlib.util
import zipfile
from pathlib import Path

import pytest


SCRIPT_PATH = Path(__file__).parents[2] / "deployment" / "prepare_local_ai.py"
SPEC = importlib.util.spec_from_file_location("prepare_local_ai", SCRIPT_PATH)
prepare_local_ai = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(prepare_local_ai)


def test_local_ai_bundle_extraction_rejects_parent_traversal(tmp_path):
    archive_path = tmp_path / "bundle.zip"
    destination = tmp_path / "extracted"
    destination.mkdir()
    with zipfile.ZipFile(archive_path, "w") as archive:
        archive.writestr("../outside.txt", "unsafe")

    with zipfile.ZipFile(archive_path) as archive, pytest.raises(SystemExit, match="unsafe member path"):
        prepare_local_ai.extract_zip_safely(archive, destination)

    assert not (tmp_path / "outside.txt").exists()


def test_local_ai_bundle_extraction_allows_normal_members(tmp_path):
    archive_path = tmp_path / "bundle.zip"
    destination = tmp_path / "extracted"
    destination.mkdir()
    with zipfile.ZipFile(archive_path, "w") as archive:
        archive.writestr("pearlix_dentex_bundle/contract/fdi_class_map.json", "{}")

    with zipfile.ZipFile(archive_path) as archive:
        prepare_local_ai.extract_zip_safely(archive, destination)

    assert (destination / "pearlix_dentex_bundle" / "contract" / "fdi_class_map.json").read_text() == "{}"
