---
title: Pearlix DENTEX AI
emoji: 🦷
colorFrom: blue
colorTo: indigo
sdk: gradio
sdk_version: 6.21.0
app_file: app.py
python_version: 3.12.12
pinned: false
---

# Pearlix DENTEX AI

Private ZeroGPU inference service for the Pearlix research/demo deployment.

- Research assistance only; not a clinical diagnosis.
- Model artifacts are mounted read-only from a private Hugging Face model repository.
- Production Pearlix calls the authenticated direct HTTPS `POST /analyze` endpoint and receives the bounded `payload` + `overlay_png_base64` envelope expected by the Django remote adapter.
- The Space must remain private; Hugging Face private-Space bearer authentication protects the direct endpoint.
- The optional Gradio UI is mounted at `/ui` for controlled human verification only; it is not the production transport.
- The service returns raw detector geometry and four locked model scores; the Pearlix Django backend independently reapplies the locked thresholds and hierarchy before persistence.
