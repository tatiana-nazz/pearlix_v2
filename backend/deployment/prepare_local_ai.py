from __future__ import annotations

import argparse
import hashlib
import shutil
import stat
import tempfile
import zipfile
from pathlib import Path

EXPECTED = {
    "weights/detector_yolo_fdi_seg_v1-3_best.pt": "29290c70b2a53e1485f90e79e78a30566be739b2366d545c8ac4db1c671b219b",
    "weights/classifier_exp1_epoch12.pt": "aa7e7d6c69de2c504d50e8813fddc6f0134613e22456ce2a6bbb1d6233d6861a",
    "contract/fdi_class_map.json": "72801acdcefb7f11560fdc063e989e68c34a9f8cd4afc6f06e941fda5c0305ec",
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def find_bundle_root(root: Path) -> Path:
    candidates = [root, root / "pearlix_dentex_bundle"]
    for candidate in candidates:
        if all((candidate / rel).is_file() for rel in EXPECTED):
            return candidate
    for detector in root.rglob("detector_yolo_fdi_seg_v1-3_best.pt"):
        candidate = detector.parent.parent
        if all((candidate / rel).is_file() for rel in EXPECTED):
            return candidate
    raise SystemExit("Could not find the locked Pearlix DENTEX bundle layout.")


def verify(root: Path) -> None:
    for rel, expected in EXPECTED.items():
        actual = sha256(root / rel)
        if actual != expected:
            raise SystemExit(f"Hash verification failed for {rel}: {actual}")


def extract_zip_safely(archive: zipfile.ZipFile, destination: Path) -> None:
    destination = destination.resolve()
    for member in archive.infolist():
        normalized_name = member.filename.replace("\\", "/")
        target = (destination / normalized_name).resolve()
        if (
            not normalized_name
            or normalized_name.startswith("/")
            or ".." in Path(normalized_name).parts
            or not target.is_relative_to(destination)
            or stat.S_ISLNK(member.external_attr >> 16)
        ):
            raise SystemExit("Bundle ZIP contains an unsafe member path.")
    archive.extractall(destination)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--bundle", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    source = Path(args.bundle).expanduser().resolve()
    output = Path(args.output).expanduser().resolve()
    if not source.exists():
        raise SystemExit(f"Bundle does not exist: {source}")

    with tempfile.TemporaryDirectory(prefix="pearlix-local-ai-") as temp_dir:
        temp = Path(temp_dir)
        if source.is_file():
            if not zipfile.is_zipfile(source):
                raise SystemExit("Bundle must be a ZIP file or extracted directory.")
            extracted = temp / "bundle"
            extracted.mkdir()
            with zipfile.ZipFile(source) as archive:
                extract_zip_safely(archive, extracted)
            root = find_bundle_root(extracted)
        else:
            root = find_bundle_root(source)

        print("Verifying all three locked SHA-256 identities...")
        verify(root)
        print("Model bundle verification PASS.")

        if output.exists():
            shutil.rmtree(output)
        shutil.copytree(root, output)
        verify(output)
        print(f"Verified local model root ready: {output}")


if __name__ == "__main__":
    main()
