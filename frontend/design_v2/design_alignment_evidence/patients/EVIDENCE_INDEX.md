# Stage 4 Patient Evidence Index

## Scope

Post-Phase-14F Stage 4 patient evidence. Backend changes: none. Migrations: none. Implementation commit: `2e2309cc278a86bceaa78d2da3166fb12c127231`; documentation amendment commit: pending.

## Capture Method

Real seeded-demo browser sessions were used after logout and a new browser tab for each role. Staff used EN Light LTR, Admin EN Dark LTR, and Doctor AR Light RTL. Measurements below are `innerWidth × innerHeight; clientWidth / documentScrollWidth / bodyScrollWidth`. “Pass” means no document-level horizontal overflow. Patient routes are represented without local identifiers.

## Staff Evidence

| File | Route/scenario | Measurement | Local scroll | Result |
| --- | --- | --- | --- | --- |
| `staff-patients-directory-1440x900-en-light.png` | Staff directory | 1440×900; 1425/1425/1425 | table 1039/1039 | pass |
| `staff-patients-search-filter-1440x900-en-light.png` | Search plus Active archive filter | 1440×900; 1440/1440/1440 | table 1054/1054 | pass |
| `staff-patient-new-1440x900-en-light.png` | New patient form | 1440×900; 1425/1425/1425 | none | pass |
| `staff-patient-validation-1440x900-en-light.png` | Required-field validation | 1440×900; 1425/1425/1425 | none | pass |
| `staff-patient-profile-overview-1440x900-en-light.png` | Profile overview | 1440×900; 1425/1425/1425 | tabs 1058/1058 | pass |
| `staff-patient-profile-appointments-1440x900-en-light.png` | Direct `?tab=appointments` | 1440×900; 1440/1440/1440 | tabs 1074/1074 | pass |
| `staff-patient-profile-visits-1440x900-en-light.png` | Direct `?tab=visits` | 1440×900; 1440/1440/1440 | tabs 1074/1074 | pass |
| `staff-patient-profile-xrays-ai-1440x900-en-light.png` | Direct `?tab=xrays` | 1440×900; 1440/1440/1440 | tabs 1074/1074 | pass |
| `staff-patient-profile-billing-1440x900-en-light.png` | Direct `?tab=billing` | 1440×900; 1440/1440/1440 | tabs 1074/1074 | pass |
| `staff-patient-edit-1440x900-en-light.png` | Edit profile | 1440×900; 1425/1425/1425 | tabs 1058/1058 | pass |
| `staff-patient-archive-confirmation-1440x900-en-light.png` | Archive confirmation | 1440×900; 1425/1425/1425 | tabs 1058/1058 | pass; existing conflict retained the record and surfaced 409 error |
| `staff-patients-responsive-1024x900-en-light.png` | Compact directory sentinel | 1024×900; 1009/1009/1009 | table 811/811 | pass |

## Admin Evidence

| File | Route/scenario | Measurement | Local scroll | Result |
| --- | --- | --- | --- | --- |
| `admin-patients-directory-1024x900-en-dark.png` | Admin directory, dark | 1024×900; 1024/1024/1024 | none | pass |
| `admin-patient-profile-readonly-1024x900-en-dark.png` | Admin profile, read-only | 1024×900; 1024/1024/1024 | none | pass; no edit control |

## Doctor Evidence

| File | Route/scenario | Measurement | Local scroll | Result |
| --- | --- | --- | --- | --- |
| `doctor-patients-directory-768x1024-ar-light-rtl.png` | Doctor directory, Arabic RTL | 768×1024; 753/753/753 | table 671/671 | pass |
| `doctor-patient-profile-768x1024-ar-light-rtl.png` | Doctor profile | 768×1024; 753/753/753 | tabs 690/701; bounded 11px tab-strip scroll | pass |
| `doctor-patient-clinical-history-768x1024-ar-light-rtl.png` | Doctor visits/clinical history | 768×1024; 768/768/768 | tabs 706/706 | pass |
| `doctor-patient-xrays-ai-768x1024-ar-light-rtl.png` | Doctor X-rays & AI | 768×1024; 768/768/768 | tabs 706/706 | pass |

## Console, Network, Permissions, And Privacy

The final browser console error log was empty. No unexpected failed request was observed. The controlled Staff archive attempt returned the existing 409 product error without changing the record. Staff actions, Admin read-only restrictions, and Doctor clinical/X-ray scope were observed. No password, token, or local identifier is recorded here.
