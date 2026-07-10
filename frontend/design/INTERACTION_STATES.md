# Interaction States

## Loading

- Initial workspace load can use a centered loading message.
- Panel/table loads should use local loading states that preserve layout.
- Mutation buttons show loading state and are disabled while submitting.

## Empty

- Empty state copy should be calm and literal.
- Examples:
  - "No appointments found for this filter."
  - "No X-rays have been saved for this patient."
  - "No billing handoffs are waiting."
- Do not show actions the current role cannot perform.

## Error

- API errors use normalized shape: `code`, `message`, `details`, `status`.
- Field validation appears under fields.
- Form-level errors appear above submit actions.
- Network errors include a retry option.

## Permission Denied

- 403 states show Access Denied.
- The frontend should hide actions that are never allowed for the role, but still handle 403 from backend.
- Do not imply the backend permission is wrong.

## Not Found

- 404 states show a not-found screen or panel.
- For security-scoped resources, copy should allow that the record may not exist or may not be available to the role.

## Form Validation

- Preserve entered values after failed submit.
- Map backend `details` to fields when possible.
- Show `non_field_errors` or unknown details as form-level messages.
- Do not submit direct appointment `status` updates. Use action endpoints.
- Do not submit invoice backend-controlled fields.
- Do not call delete for leave. Use `POST /api/availability-exceptions/{id}/cancel/`.

## Protected Media

- Fetch media with auth headers and convert to object URL.
- Show loading while blob downloads.
- Show explicit unavailable state for `AI_RESULT_UNAVAILABLE`.
- Revoke object URLs on unmount.
- Never expose protected media as a persistent public URL.
