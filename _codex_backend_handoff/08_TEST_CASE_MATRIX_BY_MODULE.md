# Test Case Matrix by Module

This file tells Codex exactly what tests should exist by the time each module is complete.

---

## 1. Foundation Tests

| ID | Test | Expected |
|---|---|---|
| FND-001 | Django system check | passes |
| FND-002 | pytest can run | passes |
| FND-003 | `/api/health/` if implemented | returns ok |
| FND-004 | base URL uses `/api/` | no `/api/v1/` routes |
| FND-005 | error response helper returns code/message/details | consistent shape |

---

## 2. Auth / Accounts Tests

| ID | Test | Expected |
|---|---|---|
| ACC-001 | login valid staff | 200 + token/session + role STAFF |
| ACC-002 | login invalid password | 401 INVALID_CREDENTIALS |
| ACC-003 | inactive user login | 403 USER_INACTIVE |
| ACC-004 | `/api/me/` anonymous | 401 |
| ACC-005 | `/api/me/` authenticated | returns id/email/full_name/role/preferences |
| ACC-006 | update theme preference valid | 200 |
| ACC-007 | update language preference valid | 200 |
| ACC-008 | invalid preference value | 400 VALIDATION_ERROR |
| ACC-009 | admin creates doctor user | 201 |
| ACC-010 | staff creates user | 403 |
| ACC-011 | doctor creates user | 403 |
| ACC-012 | admin deactivates user | 200 |

---

## 3. Clinic Settings Tests

| ID | Test | Expected |
|---|---|---|
| CLN-001 | get settings authenticated | 200 |
| CLN-002 | admin updates capacity | 200 |
| CLN-003 | staff updates settings | 403 |
| CLN-004 | doctor updates settings | 403 |
| CLN-005 | capacity 0 rejected | 400 |
| CLN-006 | default duration not allowed rejected | 400 |
| CLN-007 | unsupported currency rejected | 400 |

---

## 4. Patients Tests

| ID | Test | Expected |
|---|---|---|
| PAT-001 | staff creates patient | 201 |
| PAT-002 | admin creates patient | 403 |
| PAT-003 | doctor creates patient | 403 |
| PAT-004 | staff updates patient | 200 |
| PAT-005 | doctor updates patient | 200 |
| PAT-006 | admin updates patient | 403 |
| PAT-007 | phone search returns patient | 200 |
| PAT-008 | name search returns patient | 200 |
| PAT-009 | detail includes age if birth_date | computed |
| PAT-010 | patient profile relations endpoints protected | 401/403 as appropriate |

---

## 5. Scheduling Tests

| ID | Test | Expected |
|---|---|---|
| SCH-001 | admin creates doctor working hours | 200/201 |
| SCH-002 | staff cannot edit working hours | 403 |
| SCH-003 | doctor cannot edit working hours | 403 |
| SCH-004 | start_time >= end_time rejected | 400 |
| SCH-005 | admin creates unavailable exception | 201 |
| SCH-006 | staff cannot create exception | 403 |
| SCH-007 | doctor cannot create exception | 403 |

---

## 6. Appointment Tests

| ID | Test | Expected |
|---|---|---|
| APT-001 | staff creates valid appointment | 201 |
| APT-002 | admin creates appointment | 403 |
| APT-003 | doctor creates appointment | 403 |
| APT-004 | invalid duration rejected | 400 |
| APT-005 | outside working hours rejected | 409 OUTSIDE_WORKING_HOURS |
| APT-006 | unavailable doctor rejected | 409 DOCTOR_UNAVAILABLE |
| APT-007 | doctor exact same time conflict rejected | 409 DOCTOR_ALREADY_BOOKED |
| APT-008 | doctor overlap conflict rejected | 409 DOCTOR_ALREADY_BOOKED |
| APT-009 | capacity exact start full rejected | 409 CAPACITY_FULL |
| APT-010 | completed appointment not counted capacity | allowed |
| APT-011 | cancelled appointment not counted capacity | allowed |
| APT-012 | no-show appointment not counted capacity | allowed |
| APT-013 | staff checks in upcoming | 200 CHECKED_IN |
| APT-014 | admin check-in denied | 403 |
| APT-015 | doctor check-in denied | 403 |
| APT-016 | check-in completed appointment invalid | 409 |
| APT-017 | availability preview returns capacity | 200 |

---

## 7. Visit Tests

| ID | Test | Expected |
|---|---|---|
| VIS-001 | doctor starts own checked-in visit | 201/200 ACTIVE |
| VIS-002 | doctor starts upcoming appointment | 409 INVALID_STATUS_TRANSITION |
| VIS-003 | doctor starts another doctor's appointment | 403/404 |
| VIS-004 | staff starts visit | 403 |
| VIS-005 | admin starts visit | 403 |
| VIS-006 | one active visit per doctor | 409 ACTIVE_VISIT_EXISTS |
| VIS-007 | doctor updates active notes | 200 |
| VIS-008 | doctor updates completed notes | 200 |
| VIS-009 | staff updates notes | 403 |
| VIS-010 | admin updates notes | 403 |
| VIS-011 | complete visit updates visit+appointment | COMPLETED |
| VIS-012 | complete visit by other doctor denied | 403/404 |

---

## 8. X-ray / AI Saved Tests

| ID | Test | Expected |
|---|---|---|
| XAI-001 | doctor uploads png to visit | 201 |
| XAI-002 | doctor uploads jpg to patient | 201 |
| XAI-003 | staff uploads saved xray | 403 |
| XAI-004 | admin uploads saved xray | 403 |
| XAI-005 | pdf rejected | 415/400 |
| XAI-006 | svg rejected | 415/400 |
| XAI-007 | oversized rejected | 400 FILE_TOO_LARGE |
| XAI-008 | protected file anonymous denied | 401 |
| XAI-009 | protected file staff read saved patient allowed | 200 |
| XAI-010 | doctor run AI saved xray | 200/202 PROCESSING |
| XAI-011 | staff run AI saved xray denied | 403 |
| XAI-012 | AI result includes disclaimer | present |
| XAI-013 | overlay endpoint protected | auth+permission required |

---

## 9. External X-ray Tests

| ID | Test | Expected |
|---|---|---|
| EXT-001 | admin uploads temporary xray | 201 |
| EXT-002 | doctor uploads temporary xray | 201 |
| EXT-003 | staff uploads temporary xray | 403 |
| EXT-004 | staff lists external cases | 403 |
| EXT-005 | admin runs AI external | 200/202 |
| EXT-006 | doctor runs AI external | 200/202 |
| EXT-007 | staff runs AI external | 403 |
| EXT-008 | admin attach external to patient denied | 403 |
| EXT-009 | doctor attach external to patient | 200/201 |
| EXT-010 | attach creates saved XrayAttachment | exists |
| EXT-011 | attach copies/links AI result | exists |
| EXT-012 | discard external case | DISCARDED |
| EXT-013 | attach discarded case denied | 409 |
| EXT-014 | attach already attached case denied | 409 |

---

## 10. Billing Tests

| ID | Test | Expected |
|---|---|---|
| BIL-001 | doctor creates handoff | 201 |
| BIL-002 | staff creates handoff denied | 403 |
| BIL-003 | admin creates handoff denied | 403 |
| BIL-004 | staff converts handoff | invoice created |
| BIL-005 | admin converts handoff denied | 403 |
| BIL-006 | doctor converts handoff denied | 403 |
| BIL-007 | converted handoff cannot convert again | 409 |
| BIL-008 | staff creates invoice | 201 |
| BIL-009 | admin creates invoice denied | 403 |
| BIL-010 | doctor creates invoice denied | 403 |
| BIL-011 | staff records payment | 201 |
| BIL-012 | doctor records payment denied | 403 |
| BIL-013 | payment currency mismatch rejected | 400 |
| BIL-014 | overpayment rejected | 400 |
| BIL-015 | cancelled invoice payment rejected | 409 |
| BIL-016 | paid/remaining/status calculated | correct |
| BIL-017 | print data staff allowed | 200 |
| BIL-018 | print data admin read-only allowed | 200 |
| BIL-019 | print data doctor denied | 403 |

---

## 11. Dashboard / Audit Tests

| ID | Test | Expected |
|---|---|---|
| DSH-001 | admin dashboard admin only | 200 admin, others 403 |
| DSH-002 | staff dashboard staff only | 200 staff, others 403 |
| DSH-003 | doctor dashboard doctor only | 200 doctor, others 403 |
| AUD-001 | patient_created log exists | yes |
| AUD-002 | appointment_checked_in log exists | yes |
| AUD-003 | clinical_notes_updated log exists | yes |
| AUD-004 | payment_recorded log exists | yes |
| AUD-005 | permission_denied log optional if implemented | yes if implemented |
