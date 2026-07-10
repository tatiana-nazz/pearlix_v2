# Component Contract

This contract defines behavior and visual expectations for reusable components. Phase 13B.1 documents the contract; later phases can add implementation files as needed.

## Button

Variants:

- `primary`: main submit or workflow action.
- `secondary`: safe alternate action.
- `danger`: destructive or irreversible action, used rarely.
- `ghost`: low-emphasis toolbar action.

Rules:

- Buttons have stable height and modest radius.
- Disabled buttons show reduced opacity and preserve layout.
- Loading buttons keep their width stable when possible.
- Destructive actions require clear copy and backend confirmation where applicable.

## Card

Rules:

- Cards represent individual records, grouped summaries, or framed tools.
- Do not place cards inside decorative cards.
- Use borders by default and a subtle shadow only where elevation helps.
- Radius is 8px or less unless a modal/shell requires 10px.

## Badge

Rules:

- Badges display short status values.
- Use tinted backgrounds and readable text.
- Do not use saturated badge backgrounds for routine states.
- Badges must not be the only indicator for critical state; nearby text/action should explain what to do.

## PageHeader

Rules:

- Contains page title, optional description, and primary action.
- Keep title literal: "Appointments", "Patients", "Needs Reschedule".
- Avoid marketing copy and oversized hero treatment inside the app.

## EmptyState

Rules:

- Explain the absence in one short sentence.
- Offer a permitted action only if the role can perform it.
- Do not show create buttons to read-only roles.

## LoadingState

Rules:

- Use simple skeleton rows/cards or a calm inline loading message.
- Preserve layout dimensions to avoid large shifts.
- Avoid full-screen spinners for local panel loads.

## ErrorState

Rules:

- Show backend `message`.
- Show field errors next to fields when `details` maps to fields.
- Use a retry action for network and transient errors.
- For 403, show permission denied rather than a generic error.
- For 404, explain the resource may not exist or may not be available to the current role.

## Form Validation

Rules:

- Client validation should catch obvious missing/format issues.
- Backend validation remains authoritative.
- Never submit backend-controlled fields such as invoice status, paid amount, or appointment status spoofing.
- Availability exception delete must never be called from frontend. Use cancel endpoint only.

## Protected Media

Rules:

- Protected files are loaded through authenticated blob requests.
- Object URLs are component/session scoped and revoked on unmount.
- Do not store protected object URLs in persisted state.
