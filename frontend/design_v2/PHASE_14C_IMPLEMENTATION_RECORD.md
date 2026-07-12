# Phase 14C Implementation Record

Phase 14C adds the visible v2 foundation without changing backend runtime, APIs, permissions, routes, or migrations.

## Delivered

- CSS custom-property v2 token layers in `src/styles/v2/` for complete light/dark semantic colors, typography, spacing, radii, elevation, motion, utilities, and components.
- `AppShell` runtime composition via `WorkspaceLayout`, fixed 272/84 sidebar and 72 header, per-user local collapse key, responsive drawer, and role-safe grouped navigation.
- Lucide React named imports through the centralized `layouts/navigation.tsx` map. There is no `/admin/team` navigation destination.
- Auth-store preference persistence for LIGHT/DARK/SYSTEM and EN/AR through `PATCH /api/me/preferences/`; failures restore prior state. System theme follows media changes.
- Common v2 primitives in `src/components/v2.tsx`, plus legacy compatibility adapters for Card, PageHeader, StatusPill, and state components. Their removal owner is Phase 14F after feature composition migration.

## Scope boundaries

Shell/common copy is translated EN/AR and RTL-safe using logical CSS and bidi isolation utility. Feature page copy and feature-specific dashboard/table/form compositions remain Phase 14D–14E work. Browser visual acceptance remains Phase 14F.

Backend runtime changed: no. Migrations: none. Next phase: 14D.
