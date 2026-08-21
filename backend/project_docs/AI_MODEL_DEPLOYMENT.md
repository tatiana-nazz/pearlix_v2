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

The accepted inference runtime requires Torch `2.11.0`, TorchVision `0.26.0`, and Ultralytics `8.4.48`. CPU deployments use the accepted `+cpu` wheels. GPU deployments must preserve the same base versions while using the platform-compatible CUDA runtime.

The immutable bundle layout is:

```text
PEARLIX_AI_MODEL_ROOT/
  weights/
    detector_yolo_fdi_seg_v1-3_best.pt
    classifier_exp1_epoch12.pt
  contract/
    fdi_class_map.json
```

Never move thresholds, class order, expected hashes, or preprocessing policy into mutable environment variables.

## Supported deployment modes

### `DJANGO_INTERNAL`

The Django process loads and runs the locked bundle itself. This remains the canonical local/operator preflight path and is suitable only on a host with adequate memory and model-file access.

Configure:

```text
PEARLIX_AI_MODEL_ROOT=<trusted absolute root>
PEARLIX_AI_DETECTOR_PATH=weights/detector_yolo_fdi_seg_v1-3_best.pt
PEARLIX_AI_CLASSIFIER_PATH=weights/classifier_exp1_epoch12.pt
PEARLIX_AI_FDI_MAP_PATH=contract/fdi_class_map.json
PEARLIX_AI_DEVICE=cpu|cuda
PEARLIX_AI_MAX_CONCURRENT_INFERENCES=1
PEARLIX_AI_MAX_ACTIVE_JOBS_GLOBAL=2
PEARLIX_AI_MAX_ACTIVE_JOBS_PER_USER=1
PEARLIX_AI_INVOCATION_WINDOW_SECONDS=3600
PEARLIX_AI_MAX_INVOCATIONS_PER_USER=10
PEARLIX_AI_MAX_INVOCATIONS_GLOBAL=50
```

### `SEPARATE_SERVICE`

This mode is operational for staging through `apps.ai_results.adapters.remote`. The current zero-cost target is a **private Hugging Face ZeroGPU Space exposing the bounded direct HTTPS `POST /analyze` contract** documented in [`ZEROGPU_AI_DEPLOYMENT.md`](ZEROGPU_AI_DEPLOYMENT.md).

Configure the Django/Vercel backend with:

```text
AI_SERVICE_URL=https://<hf-user>-<space-name>.hf.space
AI_SERVICE_TOKEN=<Hugging Face read/fine-grained token authorized for the private Space>
```

Production requires the direct HTTPS origin. A Hugging Face Space ID such as `owner/space` is retained only for local/development Gradio compatibility and is rejected by production settings. The production backend posts a multipart image to `AI_SERVICE_URL/analyze`, sends the private Space token as a bearer credential, and reads a bounded JSON envelope containing `payload` and optional `overlay_png_base64`.

The remote service returns only the locked pipeline version, detector geometry, detector confidence, raw four-class model scores, runtime metadata, and optional PNG overlay. The Django backend does **not** trust remote disease decisions: it reconstructs the tooth objects and reapplies the code-locked thresholds, review band, and Deep-Caries hierarchy locally before persistence.

If the service URL/token is absent, invalid, unreachable, times out, exceeds response limits, or returns a different contract/model version, Pearlix fails closed. There is no mock fallback.

## Preflight and enablement

For an internal/local model installation, run from `backend/` with the deployment environment loaded:

```powershell
python manage.py ai_preflight --settings=config.settings.production
python manage.py ai_preflight --load-models --settings=config.settings.production
```

The default command validates trusted-root containment, regular files, all three hashes, device support, required imports, and locked runtime versions without deserializing weights. `--load-models` additionally uses the production trusted loader to validate detector names, the FDI map, classifier checkpoint metadata, architecture, class order, and epoch. Both commands are read-only and do not analyze an X-ray.

For the ZeroGPU staging path, `backend/deployment/publish_hf_ai.py` independently verifies all three locked hashes before uploading the model repository. It builds a self-contained Space from the exact Pearlix inference core, packages the shared X-ray validator, verifies clean-room importability, mounts the private model repository read-only, and publishes the Space. The generated application exposes the production direct HTTPS `/analyze` contract and retains the Gradio UI only under `/ui` for controlled human verification.

Enable real inference only after the target path is ready:

1. Verify the three immutable artifacts and hashes.
2. Verify the exact accepted runtime versions.
3. For internal mode, run both preflight commands; for ZeroGPU, verify successful Space build on ZeroGPU with the private model volume mounted.
4. Verify the direct Space `GET /health` and authenticated `POST /analyze` contract using a de-identified test input.
5. Set `ClinicSettings.ai_mode` to the intended real mode (`DJANGO_INTERNAL` or `SEPARATE_SERVICE`).
6. Run one authorized, de-identified research X-ray acceptance through the ordinary Pearlix application.
7. Verify persisted findings and overlay survive reload and remain protected by Pearlix authorization.

The demo seed must never enable mock AI or fabricate AI findings.

## Shared admission and invocation policy

AI admission is serialized through PostgreSQL state shared by every backend instance. The per-user active-job limit is attributed to the authenticated requester, not the X-ray uploader. Stable fixed-window database buckets also bound cumulative starts per requester and across the clinic; the defaults allow 10 starts per user and 50 clinic-wide starts per hour and can be tuned through the variables above. Every admitted start consumes the budget, including an attempt that later fails image validation or at the provider boundary. A request rejected before admission does not create a processing result or consume a budget slot.

## Safe disablement and mock policy

To disable external inference, remove/rotate `AI_SERVICE_TOKEN` or clear `AI_SERVICE_URL`; `SEPARATE_SERVICE` then fails safely with `AI_SERVICE_NOT_CONFIGURED` while historical real results remain intact.

`MOCK_ADAPTER` is test-harness-only. It can run only when both `ClinicSettings.ai_mode == MOCK_ADAPTER` and `PEARLIX_ALLOW_MOCK_AI=true`. A mock request with normal `PEARLIX_ALLOW_MOCK_AI=false` fails safely; no real-to-mock fallback exists.

## Measured acceptance evidence and capacity

The accepted R2C/R2D environment measured Python `3.13.2`, Torch `2.11.0+cpu`, TorchVision `0.26.0+cpu`, Ultralytics `8.4.48`, NumPy `2.5.1`, Pillow `12.3.0`, and OpenCV `5.0.0`. The historical final notebook used Python `3.12.13`; R2C proved exact independent-reference parity under Python `3.13.2`.

Measured warm panoramic inference was approximately `2.8 s`, process RSS approximately `760 MB`, and cold/model initialization approximately `3–8 s` across measured runs. These are machine-specific measurements, not formal minimum requirements.

CPU is sufficient for the functional MVP when adequately provisioned. Use one model-loaded process and `PEARLIX_AI_MAX_CONCURRENT_INFERENCES=1` initially because each process can load its own detector/classifier bundle and multiply RAM. Provide approximately `1.5–2 GB` or more available memory for a conventional CPU container. The free ZeroGPU staging path instead uses dynamic GPU allocation and accepts queue/sleep/quota behavior as a research-demo constraint.

## Security and upgrades

- Keep model artifacts out of Git and the public web root.
- Mount/serve the model bundle read-only with least privilege.
- Verify hashes at every model publication/deployment; never bypass verification.
- Keep the ZeroGPU Space and model repository private for the current staging design.
- Keep Hugging Face/Vercel tokens in platform secrets only.
- Never print bearer-token values in launcher/deployment output; copy secrets through a trusted local clipboard or platform-secret flow.
- Do not expose preflight or artifact paths through public HTTP.
- Never log image bytes, raw score matrices, patient data, secrets, or storage paths.
- Never commit `*.pt`, `.local/ai_integration`, golden X-rays, generated overlays, `.env`, or temporary smoke output.

A future model upgrade requires a new immutable bundle and pipeline version, reviewed code-locked hashes/contract, independent golden-equivalence evidence, explicit clinical/research acceptance, full automated/browser regression, and an intentional deployment change. Never overwrite the locked model identity, silently reinterpret historical results, or reuse this pipeline version for different artifacts.
