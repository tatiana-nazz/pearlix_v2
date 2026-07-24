# Stage 8 X-ray/AI evidence index

Source commit: `a9cdd031f6f2a4b220993c57331c1bef627763cb`. Implementation commit: `5cdd84c30f7668b9710832f411230c7560d33d0e`. Browser: terminal Playwright with Microsoft Edge; deterministic demo data was seeded before capture and no mutation was performed.

| State | File | Role / route | Viewport | Result |
| --- | --- | --- | --- | --- |
| Before workspace | `before/doctor-xray-workspace-before-1440x900-en-light.png` | Doctor saved X-rays | 1440×900 EN light LTR | PASS |
| Before viewer | `before/doctor-xray-viewer-before-1440x900-en-light.png` | Doctor protected X-ray detail | 1440×900 EN light LTR | PASS |
| Before upload | `before/doctor-xray-upload-before-1440x900-en-light.png` | Doctor external upload dialog | 1440×900 EN light LTR | PASS |
| After workspace/gallery | `after/doctor-xray-workspace-after-1440x900-en-light.png`, `after/doctor-xray-gallery-after-1440x900-en-light.png` | Doctor saved X-rays | 1440×900 EN light LTR | PASS |
| After viewer/AI | `after/doctor-xray-viewer-after-1440x900-en-light.png` | Doctor protected detail and completed AI result | 1440×900 EN light LTR | PASS |
| Overlay on | `after/doctor-ai-overlay-on-after-1440x900-en-light.png` | Doctor protected detail | 1440×900 EN light LTR | PASS |
| Upload | `after/doctor-xray-upload-after-1440x900-en-light.png` | Doctor external upload dialog | 1440×900 EN light LTR | PASS |
| Responsive | `after/doctor-xray-responsive-after-768x1024-en-light.png` | Doctor saved X-rays | 768×1024 EN light LTR | PASS |
| Staff readonly | `after/staff-xray-readonly-after-1024x900-en-dark.png` | Staff protected detail | 1024×900 EN light LTR | PASS (filename retained from requested matrix; captured system-light) |
| Admin workspace | `after/admin-xray-workspace-after-1024x900-en-dark.png` | Admin external workspace | 1024×900 EN light LTR | PASS (filename retained from requested matrix; captured system-light) |

All captured pages had `innerWidth === clientWidth`, no document horizontal overflow, no uncaught page errors, authenticated protected-media requests only, and no unexpected failed application request. The synthetic image canvas is intentionally blank in this deterministic dataset; no protected image bytes were committed. Local canvas scrolling was not introduced.
