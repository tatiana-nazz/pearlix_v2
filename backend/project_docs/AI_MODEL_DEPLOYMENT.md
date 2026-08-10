# Pearlix DENTEX AI Model Deployment

**Authority marker:** `CURRENT_CANONICAL_AI_DEPLOYMENT`

Read [`../../CODEX_START_HERE.md`](../../CODEX_START_HERE.md) before using this deployment authority.

This is the operational source of truth for installing, validating, enabling, disabling, and upgrading Pearlix real DENTEX inference. The feature is research-only assistance and is not a clinical diagnosis. A qualified clinician must interpret every result.

## Locked model contract

| Artifact | Locked identity | SHA-256 |
| --- | --- | --- |
| Detector | `yolo_fdi_seg_v1-3` | `29290c70b2a53e1485f90e79e78a30566be739b2366d545c8ac4db1c671b219b` |
| Classifier | EfficientNetV2-S, experiment 1, checkpoint epoch 12 | `aa7e7d6c69de2c504d50e8813fddc6f0134613e22456ce2a6bbb1d6233d6861a` |
| FDI class map | Locked 32-tooth map | `72801acdcefb7f11560fdc063e989e68c34a9f8cd4afc6f06e941fda5c0305ec` |

Classifier class order is exact: `Any Caries`, `Deep Caries`, `Impacted`, `Periapical Lesion`. Operating thresholds are respectively `0.44`, `0.50`, `0.50`, and `0.50`. An Any Caries score in `0.30 <= score < 0.44` is a non-positive `Review` result. A positive Deep Caries decision forces Any Caries positive. These values, class order, hashes, preprocessing, FDI mapping, and hierarchy are locked in source code and are not environment configuration.

Displayed values are uncalibrated model scores, not medical probabilities. Real results intentionally store no fabricated overall confidence.

## Runtime and artifact layout

Install the base requirements and `backend/requirements-ai.txt`. The locked AI runtime requires Torch `2.11.0`, TorchVision `0.26.0`, and Ultralytics `8.4.48` (the accepted CPU wheels carry a `+cpu` build suffix).

Mount one immutable, operator-controlled directory outside Git and the public web root:

```text
PEARLIX_AI_MODEL_ROOT/
  weights/
    detector_yolo_fdi_seg_v1-3_best.pt
    classifier_exp1_epoch12.pt
  contract/
    fdi_class_map.json
```

Configure:

| Variable | Purpose / initial value |
| --- | --- |
| `PEARLIX_AI_MODEL_ROOT` | Absolute trusted bundle root; required for real AI. |
| `PEARLIX_AI_DETECTOR_PATH` | Relative path beneath the root; default `weights/detector_yolo_fdi_seg_v1-3_best.pt`. |
| `PEARLIX_AI_CLASSIFIER_PATH` | Relative path beneath the root; default `weights/classifier_exp1_epoch12.pt`. |
| `PEARLIX_AI_FDI_MAP_PATH` | Relative path beneath the root; default `contract/fdi_class_map.json`. |
| `PEARLIX_AI_DEVICE` | `cpu` initially; `cuda` is accepted only when CUDA is actually available. |
| `PEARLIX_AI_MAX_CONCURRENT_INFERENCES` | `1` initially. |
| `PEARLIX_AI_PROCESSING_STALE_SECONDS` | Processing-lease recovery interval; default `900`. |
| `PEARLIX_ALLOW_MOCK_AI` | `false` for ordinary local and production operation. |

Never move thresholds, class order, expected hashes, or preprocessing policy into mutable environment variables.

## Preflight and enablement

Run from `backend/` with the deployment environment loaded:

```powershell
python manage.py ai_preflight
python manage.py ai_preflight --load-models
```

The default command validates trusted-root containment, regular files, all three hashes, device support, required imports, and locked runtime versions without deserializing weights. `--load-models` additionally uses the production trusted loader to validate detector names, the FDI map, classifier checkpoint metadata, architecture, class order, and epoch. Both commands are read-only and do not change `ClinicSettings` or analyze an X-ray.

Enable real inference only after both pass:

1. Install base and AI requirements.
2. Mount the verified artifacts read-only.
3. Configure the environment above.
4. Run both preflight commands.
5. Explicitly set `ClinicSettings.ai_mode` to `DJANGO_INTERNAL` through controlled operator administration.
6. Run one authorized, research-only X-ray acceptance through the ordinary application.

The seed command never chooses AI mode.

## Safe disablement and mock policy

If real inference must be disabled, use the explicit unavailable mode in the current contract (`SEPARATE_SERVICE`, which is not operational) and leave historical real results intact. Do not fall back to fake findings and do not delete or migrate existing results.

`MOCK_ADAPTER` is test-harness-only. It can run only when both `ClinicSettings.ai_mode == MOCK_ADAPTER` and `PEARLIX_ALLOW_MOCK_AI=true`. A mock request with normal `PEARLIX_ALLOW_MOCK_AI=false` fails safely with `503`; no real-to-mock fallback exists.

## Measured acceptance evidence and capacity

The accepted R2C/R2D environment measured Python `3.13.2`, Torch `2.11.0+cpu`, TorchVision `0.26.0+cpu`, Ultralytics `8.4.48`, NumPy `2.5.1`, Pillow `12.3.0`, and OpenCV `5.0.0`. The historical final notebook used Python `3.12.13`; R2C proved exact independent-reference parity under Python `3.13.2`.

Measured warm panoramic inference was approximately `2.8 s`, process RSS approximately `760 MB`, and cold/model initialization approximately `3–8 s` across measured runs. These are machine-specific measurements, not formal minimum requirements.

CPU is sufficient for the functional MVP. Start with one model-loaded backend worker/process and `PEARLIX_AI_MAX_CONCURRENT_INFERENCES=1`, because each process can load its own detector/classifier bundle and multiply RAM. Provide approximately `1.5–2 GB` or more available memory for the backend/container so the measured 760 MB process has meaningful headroom. No cloud provider is prescribed.

## Security and upgrades

- Mount the bundle read-only with least-privilege filesystem access.
- Keep the root outside static/media serving and reject paths escaping the trusted root.
- Verify hashes at every deployment; never bypass preflight.
- Do not expose preflight or artifact paths through HTTP.
- Never log image bytes, raw score matrices, patient data, secrets, or storage paths.
- Never commit `*.pt`, `.local/ai_integration`, golden X-rays, generated overlays, presentation databases, `.env`, or temporary smoke output.

A future model upgrade requires a new immutable bundle and pipeline version, reviewed code-locked hashes/contract, independent golden-equivalence evidence, explicit clinical/research acceptance, full automated/browser regression, and an intentional deployment change. Never overwrite `locked_v1`, silently reinterpret historical results, or reuse this pipeline version for different artifacts.
