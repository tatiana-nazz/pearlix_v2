from __future__ import annotations

import argparse
import hashlib
import shutil
import tempfile
import zipfile
from pathlib import Path


EXPECTED = {
    "weights/detector_yolo_fdi_seg_v1-3_best.pt": "29290c70b2a53e1485f90e79e78a30566be739b2366d545c8ac4db1c671b219b",
    "weights/classifier_exp1_epoch12.pt": "aa7e7d6c69de2c504d50e8813fddc6f0134613e22456ce2a6bbb1d6233d6861a",
    "contract/fdi_class_map.json": "72801acdcefb7f11560fdc063e989e68c34a9f8cd4afc6f06e941fda5c0305ec",
}
CORE_FILES = (
    "backend/apps/__init__.py",
    "backend/apps/ai_results/__init__.py",
    "backend/apps/ai_results/model_contract.py",
    "backend/apps/ai_results/result_types.py",
    "backend/apps/ai_results/overlay.py",
    "backend/apps/ai_results/adapters/__init__.py",
    "backend/apps/ai_results/adapters/base.py",
    "backend/apps/ai_results/adapters/dentex.py",
)


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
    matches = [path.parent.parent for path in root.rglob("detector_yolo_fdi_seg_v1-3_best.pt")]
    for candidate in matches:
        if all((candidate / rel).is_file() for rel in EXPECTED):
            return candidate
    raise SystemExit("Could not find the locked Pearlix DENTEX bundle layout.")


def verify_bundle(root: Path) -> None:
    for rel, expected in EXPECTED.items():
        actual = sha256(root / rel)
        if actual != expected:
            raise SystemExit(f"Hash verification failed for {rel}: {actual}")


def build_space(repo_root: Path, output: Path) -> None:
    shutil.copytree(repo_root / "hf_space", output, dirs_exist_ok=True)
    for rel in CORE_FILES:
        source = repo_root / rel
        target = output / Path(rel).relative_to("backend")
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)


def upload_model_bundle(api, *, bundle_root: Path, model_repo: str, legacy_upload: bool) -> None:
    if not legacy_upload:
        api.upload_folder(repo_id=model_repo, repo_type="model", folder_path=str(bundle_root))
        return

    files = sorted(
        (path for path in bundle_root.rglob("*") if path.is_file()),
        key=lambda path: (path.stat().st_size, path.as_posix()),
    )
    print(f"Compatibility upload: {len(files)} files will be sent one at a time with hf-xet disabled.")
    for index, path in enumerate(files, start=1):
        relative = path.relative_to(bundle_root).as_posix()
        size_mb = path.stat().st_size / (1024 * 1024)
        print(f"[{index}/{len(files)}] Uploading {relative} ({size_mb:.1f} MB)...", flush=True)
        api.upload_file(
            repo_id=model_repo,
            repo_type="model",
            path_or_fileobj=str(path),
            path_in_repo=relative,
            commit_message=f"Upload {relative}",
        )
        print(f"[{index}/{len(files)}] Uploaded {relative}.", flush=True)


def parse_args():
    parser = argparse.ArgumentParser(
        description="Publish Pearlix DENTEX to a private free Hugging Face ZeroGPU Space."
    )
    parser.add_argument(
        "--bundle", required=True, help="Path to pearlix-dentex-model-bundle.zip or its extracted directory."
    )
    parser.add_argument("--space-name", default="pearlix-dentex-ai")
    parser.add_argument("--model-name", default="pearlix-dentex-models")
    parser.add_argument(
        "--legacy-upload",
        action="store_true",
        help="Disable hf-xet in the parent process and upload model files sequentially over the compatibility HTTP path.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    try:
        from huggingface_hub import HfApi, Volume
    except ImportError as exc:
        raise SystemExit(
            "Install huggingface_hub first (the companion PowerShell script does this automatically)."
        ) from exc

    repo_root = Path(__file__).resolve().parents[2]
    bundle_arg = Path(args.bundle).expanduser().resolve()
    if not bundle_arg.exists():
        raise SystemExit(f"Bundle does not exist: {bundle_arg}")

    with tempfile.TemporaryDirectory(prefix="pearlix-hf-publish-") as temp_dir:
        temp = Path(temp_dir)
        if bundle_arg.is_file():
            if not zipfile.is_zipfile(bundle_arg):
                raise SystemExit("--bundle must be a ZIP file or extracted bundle directory.")
            extracted = temp / "bundle"
            extracted.mkdir()
            with zipfile.ZipFile(bundle_arg) as archive:
                archive.extractall(extracted)
            bundle_root = find_bundle_root(extracted)
        else:
            bundle_root = find_bundle_root(bundle_arg)

        print("Verifying all three locked SHA-256 identities...")
        verify_bundle(bundle_root)
        print("Model bundle verification PASS.")

        api = HfApi()
        who = api.whoami()
        username = who.get("name") or who.get("fullname")
        if not username:
            raise SystemExit(
                "Could not resolve the authenticated Hugging Face username. Run `hf auth login` first."
            )

        model_repo = f"{username}/{args.model_name}"
        space_repo = f"{username}/{args.space_name}"

        print(f"Creating/updating private model repo: {model_repo}")
        api.create_repo(repo_id=model_repo, repo_type="model", private=True, exist_ok=True)
        upload_model_bundle(
            api,
            bundle_root=bundle_root,
            model_repo=model_repo,
            legacy_upload=args.legacy_upload,
        )

        space_build = temp / "space"
        build_space(repo_root, space_build)

        print(f"Creating/updating private ZeroGPU Space: {space_repo}")
        try:
            api.create_repo(
                repo_id=space_repo,
                repo_type="space",
                private=True,
                exist_ok=True,
                space_sdk="gradio",
                space_hardware="zero-a10g",
                space_volumes=[
                    Volume(type="model", source=model_repo, mount_path="/models", read_only=True)
                ],
            )
        except Exception as exc:
            raise SystemExit(
                "Hugging Face could not create the free ZeroGPU Space. Free ZeroGPU hosting requires a personal "
                "account in good standing with verified email and account age over 30 days. Original error: "
                + str(exc)
            ) from exc

        api.set_space_volumes(
            repo_id=space_repo,
            volumes=[Volume(type="model", source=model_repo, mount_path="/models", read_only=True)],
        )
        api.request_space_hardware(repo_id=space_repo, hardware="zero-a10g")
        api.upload_folder(
            repo_id=space_repo,
            repo_type="space",
            folder_path=str(space_build),
            delete_patterns="*",
        )

        runtime = api.get_space_runtime(repo_id=space_repo)
        print("\nPearlix Hugging Face publication complete.")
        print(f"MODEL_REPO_ID={model_repo}")
        print(f"AI_SERVICE_URL={space_repo}")
        print(f"SPACE_STAGE={runtime.stage}")
        print(f"SPACE_HARDWARE={runtime.hardware}")
        print(f"SPACE_REQUESTED_HARDWARE={runtime.requested_hardware}")
        print(
            "\nNext: create a Hugging Face READ/fine-grained token for this private Space. "
            "Do not paste it into chat."
        )
        print(
            "Set that token in the Vercel backend as AI_SERVICE_TOKEN, and set AI_SERVICE_URL to the value above."
        )


if __name__ == "__main__":
    main()
