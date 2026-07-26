# Phase 14E.4A Protected X-ray and Overlay Visual Browser Acceptance Closure

## Purpose and authority

This closure resolves the Phase 14E.4 visual-browser evidence gap without changing the protected-media security model, backend contract, role boundary, responsive system, or X-ray workspace design. Authority read included the current root/status/role/UI documents, Phase 14E.4 evidence, X-ray QA, protected-media hook/API client, viewer and overlay components, X-ray tests, protected-file endpoints/permission tests, Playwright configuration, and deterministic demo story.

## Proven correction

Browser acceptance reproduced a `404` protected-media failure despite the synthetic file existing and the backend endpoint being valid. The serializer returns authenticated endpoints beginning `/api/`; passing those endpoints unchanged to an Axios client already based at `/api` produced `/api/api/xrays/...` requests. `api/http.ts` now normalizes backend-returned `/api/...` endpoint values to the configured API-base-relative path before the original request and a token-refresh retry. This is a frontend URL-resolution correction only; endpoint shape, authorization headers, Blob handling, file response, storage, permissions, and backend code are unchanged.

## Chromium acceptance evidence

The reset-safe DEBUG demo story was exercised through Playwright Chromium using the configured Chrome channel. The browser confirmed `typeof URL.createObjectURL === "function"` and authenticated Doctor access to the existing synthetic X-ray with stored AI data.

- The protected original returned `200 image/png`, rendered as a `blob:` URL, and had positive natural width and height.
- Selecting **Show overlay** changed the toggle to pressed/Hide overlay, fetched the protected overlay, rendered its `blob:` URL, and produced positive natural dimensions.
- Navigating away through the existing SPA link revoked the original and overlay object URLs.
- A deliberately aborted protected-media request displayed the existing truthful protected-image failure state and rendered no image.
- No raw media URL, storage path, token, object URL, image bytes, screenshot, trace, database, credential, or browser profile was committed. The disposable demo story was reset after acceptance.

## Regression and boundaries

The focused Chromium suite adds stable coverage for visible protected original/overlay rendering, toggle presentation, dimensions, temporary URL revocation, and failure handling. Existing collection rows remain action-free, detail actions remain detail-only, stored results remain non-diagnostic, RBAC remains unchanged, and the responsive shell/breakpoints were not modified.

Final validation: TypeScript typecheck, 133 Vitest tests in 46 files, 5 Playwright tests, production build, Django check, migration-drift check, 420 backend tests, documentation consistency, and checker compilation passed. This record is implementation evidence, not product authority.
