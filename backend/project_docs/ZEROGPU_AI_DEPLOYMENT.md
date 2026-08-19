# Pearlix — Zero-Cost Hugging Face ZeroGPU AI Deployment

**Scope:** research/demo staging only. This does not make Pearlix a clinically validated diagnostic system.

## Architecture

```text
Vercel pearlix-web-staging
        |
Vercel pearlix-api-staging
        |
        +-- Supabase PostgreSQL + private X-ray storage
        |
        +-- private Hugging Face Gradio ZeroGPU Space
                    |
                    +-- read-only mounted private HF model repository
```

The Vercel backend stays lightweight. The Space runs the locked DENTEX detector/classifier on ZeroGPU and returns detector geometry plus raw four-class model scores. Pearlix **reapplies its locked thresholds, Any-Caries review band, and Deep-Caries hierarchy locally** before persisting results. No remote decision is trusted directly.

## Locked artifacts

The publisher refuses to deploy unless all three hashes match:

- `weights/detector_yolo_fdi_seg_v1-3_best.pt` — `29290c70b2a53e1485f90e79e78a30566be739b2366d545c8ac4db1c671b219b`
- `weights/classifier_exp1_epoch12.pt` — `aa7e7d6c69de2c504d50e8813fddc6f0134613e22456ce2a6bbb1d6233d6861a`
- `contract/fdi_class_map.json` — `72801acdcefb7f11560fdc063e989e68c34a9f8cd4afc6f06e941fda5c0305ec`

## Free-tier constraint

Use a personal Hugging Face account that is eligible to create a ZeroGPU Gradio Space. Do not select T4/L4/A10G/A100 paid hardware and do not add prepaid credits for this staging deployment.

The publisher requests the Hub hardware flavor `zero-a10g` (the Hub API identifier for ZeroGPU). The Space and model repositories are both created **private**. The model repository is attached read-only as `/models`; weights are not committed to GitHub or copied into the Space source repository.

## Publish

1. Download the verified `pearlix-dentex-model-bundle.zip` supplied during deployment.
2. Pull the current `main` branch.
3. From PowerShell:

```powershell
cd D:\pearlix_v2
git pull --ff-only origin main
cd backend
.\deployment\publish_hf_ai.ps1 -Bundle "C:\path\to\pearlix-dentex-model-bundle.zip"
```

The helper creates an isolated `.hf-deploy-venv`, authenticates through `hf auth login`, verifies the three hashes, uploads a private model repo, builds the Space from the exact Pearlix inference core, mounts the model repo read-only, requests ZeroGPU, and uploads the Space.

Expected output includes:

```text
Model bundle verification PASS.
MODEL_REPO_ID=<hf-user>/pearlix-dentex-models
AI_SERVICE_URL=<hf-user>/pearlix-dentex-ai
SPACE_REQUESTED_HARDWARE=zero-a10g
```

If the Hub rejects ZeroGPU creation because the personal account is not eligible, stop. Do not fall back to paid hardware merely to make deployment succeed.

## Backend authentication and enablement

After the private Space exists, create a Hugging Face read/fine-grained access token suitable for calling that Space. Keep it private and do not paste it into chat, Git, or screenshots.

Set these on the **Vercel backend project**:

```text
AI_SERVICE_URL=<hf-user>/pearlix-dentex-ai
AI_SERVICE_TOKEN=<private HF read/fine-grained token>
```

`ClinicSettings.ai_mode` must be `SEPARATE_SERVICE`. The current staging seed already uses that mode. Until both environment variables are present and valid, Pearlix fails closed with `AI_SERVICE_NOT_CONFIGURED`; there is no mock fallback.

Redeploy the Vercel backend after setting the variables.

## Acceptance

Use one de-identified research panoramic X-ray through the ordinary Pearlix UI and verify:

1. upload remains protected through Pearlix/Supabase;
2. `Run AI` calls the private ZeroGPU Space;
3. remote response model version equals the locked Pearlix pipeline version;
4. Pearlix locally reapplies locked decisions;
5. result and overlay persist in Supabase-backed storage;
6. reload/history returns the same persisted result;
7. unauthorized roles cannot access protected X-rays or AI artifacts;
8. a wrong/absent HF token fails closed instead of fabricating findings.

The free ZeroGPU service can sleep, queue, and enforce daily GPU quota. That is acceptable for thesis/research demonstration but not for an always-on production clinic SLA.
