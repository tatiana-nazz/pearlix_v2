# Security and Threat Model — Detailed

## 1. Security Principle

Frontend role guards improve UX. Backend permissions are security.

Every protected endpoint must check:

1. authenticated user
2. role permission
3. object-level permission
4. valid workflow state
5. valid business input

---

## 2. Authentication Risks

Risks:

- stolen token/session
- weak password
- inactive user login
- frontend trusting role in localStorage
- long-lived access tokens

Rules:

- require auth for all protected `/api/` endpoints
- inactive users cannot login
- role comes from backend `/api/me/`
- logout clears frontend session
- production uses HTTPS

---

## 3. Authorization Risks

Risks:

- Admin performing Staff operations
- Staff editing notes or uploading X-rays
- Doctor creating invoices
- Staff accessing external X-ray/AI
- Admin attaching external X-ray to patient
- IDOR by changing IDs in URL

Rules:

- server-side permission classes
- object-level permission checks
- explicit denial tests for every forbidden role/action

---

## 4. Patient Data Protection

Rules:

- no public patient APIs
- no patient data in localStorage
- no patient identity in filenames/URLs
- pagination for lists
- backend-filtered results by role
- clear cache on logout

---

## 5. Clinical Notes Protection

Rules:

- Staff/Admin read-only
- Doctor editable
- completed notes editable forever by Doctor
- show timestamps and updated_by
- AI never writes diagnosis/treatment automatically

---

## 6. Appointment Abuse Protection

Threats:

- capacity bypass
- doctor double booking
- appointment outside working hours
- start visit before check-in
- multiple active visits

Controls:

- backend revalidates all booking rules on create/update
- use transactions for appointment creation/update
- reject invalid transitions
- test race-sensitive logic where practical

---

## 7. File Upload Security

Allowed X-ray originals: png, jpg, jpeg.  
Allowed overlay: png.

Required controls:

- extension allowlist
- content/MIME validation where practical
- file size limit
- random safe filenames
- no SVG/PDF/ZIP/EXE
- no executable storage
- protected file endpoints only

---

## 8. Protected Media Access

Never expose public predictable URLs.

Use endpoints:

- `/api/xrays/{id}/file/`
- `/api/xrays/{id}/ai-overlay/`
- `/api/external-xrays/{id}/file/`
- `/api/external-xrays/{id}/ai-overlay/`

Each endpoint checks permission before serving.

---

## 9. External X-ray/AI Security

Rules:

- Staff denied completely.
- Admin can upload/run/view/discard but cannot attach.
- Doctor can upload/run/view/discard/attach.
- Attach creates saved patient X-ray only through doctor action.
- Discarded external cases should not appear in active lists.

---

## 10. Billing Security

Rules:

- Doctor creates handoff only.
- Staff converts handoff to invoice.
- Admin read-only.
- Converted handoff cannot be converted again.
- backend calculates invoice paid/remaining/status.
- payment currency must match invoice.
- no overpayment.
- no payment on cancelled invoice.

---

## 11. Audit Logging

Log these actions:

- login_failed
- user_created/deactivated
- settings_updated
- patient_created/updated
- appointment_created/checked_in/cancelled/no_show
- visit_started/completed
- clinical_notes_updated
- xray_uploaded
- external_xray_uploaded/discarded/attached
- ai_run_started/completed/failed
- billing_handoff_created/converted/dismissed
- invoice_created/updated/cancelled
- payment_recorded
- permission_denied

Do not log passwords, tokens, full X-ray contents, or full notes unless explicitly required.

---

## 12. Environment Variables

Use env vars for:

- SECRET_KEY
- DEBUG
- DATABASE_URL
- ALLOWED_HOSTS
- CORS_ALLOWED_ORIGINS
- FRONTEND_URL
- AI_SERVICE_URL
- AI_SERVICE_TOKEN
- MEDIA storage credentials

Production:

- DEBUG=false
- strict CORS
- HTTPS
- secrets not committed

---

## 13. Security Test Requirements

Security tests are required in every phase that touches permissions or sensitive data.

Minimum regression tests:

- unauthenticated denied
- wrong role denied
- object-level IDOR denied
- file uploads validated
- protected files require permission
- AI disclaimer always present
- frontend-computed status/money values ignored
