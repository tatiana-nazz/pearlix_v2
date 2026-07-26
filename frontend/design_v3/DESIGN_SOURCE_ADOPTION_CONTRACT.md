# Phase 14F Design Source Adoption Contract

## Authority

The supplied visual reference pack is authoritative for visual language only. Pearlix runtime code, current API contracts, backend-enforced RBAC, `CURRENT_BACKEND_DECISIONS.md`, `CURRENT_PRODUCT_UI_SOURCE_OF_TRUTH.md`, route guards, tests, and responsive transformations remain authoritative for behavior.

The adopted reference inputs were:

- the manifest and `src.zip` under `D:\pearlix_visual_reference\pearlix_visual_reference_pack`;
- six supplied screenshots covering Staff appointments, Staff profile, Team member detail, Doctor appointments, Admin working hours, and patient profile;
- the reference theme, shell, component, overlay, and page composition sources.

The reference was inspected from an extracted copy outside Git. Reference files, screenshots, test credentials, browser traces, and generated evidence are not repository source.

## Adopted visual rules

- Manrope-first typography with the existing Arabic fallback.
- `#f6f8fc` canvas, white surfaces, `#f9fafd` soft surfaces, `#e5eaf3` borders, and `#eef1f6` dividers.
- `#3f63f2` primary, `#5baef7` secondary, `#14b8a6` teal, and the supplied success, warning, danger, text, muted, and disabled colors.
- 12px controls, 20px cards, 24px dialogs, 44px controls, 264px expanded sidebar, 76px compact sidebar, and 68px topbar.
- The supplied primary/page gradients and card/modal shadows.
- White sidebar, blue active state, gradient clinical brand tile, restrained topbar utilities, elevated cards, segmented tabs, soft form controls, and dark-blue modal backdrops.
- Split identity/detail composition for patient profiles and an identity-led three-column Staff/Doctor own-profile composition.
- Separate appointment navigation, filters, calendar content, and week-summary surfaces.

## Explicitly excluded prototype code

The following reference implementation categories were not adopted:

- `src/api/*` and all prototype endpoint wrappers;
- `src/data/*`, mock fixtures, mock storage, mock clinic state, and mock schedule state;
- prototype session/auth contexts, route authority, and role decisions;
- fake X-ray files, fake AI inference/results, public media URLs, or client-generated clinical output;
- prototype appointment mutation columns or any collection-level action model that conflicts with Phase 14E.1A;
- prototype billing, payment, user, Team, patient, or scheduling behavior that is not supported by current Pearlix APIs;
- reference breakpoints where they conflicted with the frozen Pearlix 1279px, 1023px, and 767px transformations.

## Preservation contract

- No backend production code, serializer, permission, endpoint, or migration change.
- Team and Users & Access remain separate.
- Collection records remain action-free and open detail as a whole row/card.
- Admin remains supervisory/read-only where current contracts require it.
- Staff retains current operational mutations.
- Doctors retain all active/non-archived patient access, own appointment/visit scope, no global Billing navigation, and no invoice/payment capability.
- Protected X-ray and overlay bytes continue through authenticated Blob requests; the frontend only normalizes backend-provided `/api/...` media paths against an API base that already ends in `/api`.
- English/Arabic, RTL, LIGHT/DARK/SYSTEM preferences, keyboard operation, focus visibility, reduced motion, and the existing responsive transformations remain supported.

## Change rule

Later work may extend this visual system, but it must not reintroduce reference prototype behavior or fragment the semantic token layer. New values should enter through the Phase 14F tokens and shared primitives before route-local styling is considered.
