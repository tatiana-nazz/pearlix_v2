# Phase 14F.3 Visual Stability, Active Visit, AI Overlay, and Cleanup QA

**Date:** 2026-07-26

**Reference date:** `2026-07-26` (`Asia/Damascus`)

**Dataset marker:** `phase-14a-integrated-demo-story` (left populated)

## Automated gates

- Frontend production build and TypeScript project check passed.
- Frontend unit/component regression passed: 147 tests in 49 files.
- Focused demo-story regression passed: 5 tests, including split-shift compatibility, active-visit ownership/editing permissions, and transparent overlay protection.
- Complete backend regression passed: 425 tests.
- Complete serial Chromium regression passed: 14 scenarios. Three Phase 14F.3 scenarios cover the seven required viewports, content-sized badges, repeated-card rows, Doctor One shifts/active visit, layered overlay geometry, Arabic toggle, and Admin settings.

## Direct browser verification

- Appointment status badges computed as `inline-flex`, `flex-grow: 0`, and narrower than their containing status cells.
- Dashboard KPI, Team, Billing summary, and Clinic Settings cards aligned within each repeated desktop/tablet grid row; mobile cards retained natural height.
- Doctor One profile rendered Morning and Evening rows with Saturday/Sunday Off. The active-visit route rendered Lina Mansour with editable clinical notes.
- The stored mock-AI X-ray rendered exactly one viewer and one canvas. Enabling the AI overlay produced identical original/overlay x, y, width, and height geometry with zero document overflow.
- Exact responsive matrix: 1920×1080, 1536×864, 1440×900, 1366×768, 1280×720, 1024×768, and 768×1024.
- English/Arabic, RTL, LIGHT/DARK, keyboard controls, `aria-pressed`, and protected-media access were retained.

## Generated evidence

In-app-browser inspection and Playwright failure evidence were used during correction. Passing acceptance is represented by the committed automated specifications; `frontend/test-results` is removed before commit.
