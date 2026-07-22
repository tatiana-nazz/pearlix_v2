# Stage 5 team-management evidence

Branch: `post-14f-medical-blue-team-management`  
Source commit: `03f012d7b489a8adb61c80da0f6a830d8f24059a`  
Deterministic state: `seed_demo_clinic_story --reset-demo --include-must-change-user --reference-date 2026-07-19`.

All captures use real local browser rendering. No page-level horizontal overflow occurred: document and body widths were at or below client width. Console/network: no blocking errors observed. Mutations: none; destructive dialogs were not confirmed.

| Evidence | State / route | Role, viewport, preferences | Measurements (inner/client/document/body) | Result |
| --- | --- | --- | --- | --- |
| `before/admin-team-directory-before-1440x900-en-light.png` | Team cards `/admin/team` | Admin, EN light LTR, 1440×900 | 1440×900 / 1425 / 1425 / 1425 | pass |
| `before/admin-team-member-before-1440x900-en-light.png` | Team overview `/admin/team/175` | Admin, EN light LTR, 1440×900 | 1440×900 / 1440 / 1440 / 1440 | pass |
| `before/admin-users-before-1440x900-en-light.png` | Users list `/admin/users` | Admin, EN light LTR, 1440×900 | 1440×900 / 1425 / 1425 / 1425 | pass |
| `before/admin-schedules-before-1024x900-en-dark.png` | Schedule `/admin/doctors` | Admin, EN dark LTR, 1024×900 | 1024×900 / 1009 / 1009 / 1009 | pass |
| `before/admin-leave-before-1024x900-en-dark.png` | Leave `/admin/leave` | Admin, EN dark LTR, 1024×900 | 1024×900 / 1009 / 1009 / 1009 | pass |
| `before/staff-team-before-1024x900-en-light.png` | Team `/staff/team` | Staff, EN light LTR, 1024×900 | 1024×900 / 1009 / 1009 / 1009 | read-only pass |
| `before/staff-profile-before-1024x900-en-light.png` | Profile `/staff/profile` | Staff, EN light LTR, 1024×900 | 1024×900 / 1024 / 1024 / 1024 | pass |
| `before/doctor-profile-before-768x1024-ar-light-rtl.png` | Profile `/doctor/profile` | Doctor, AR light RTL, 768×1024 | 768×1024 / 768 / 768 / 768 | pass |
| `after/admin-team-directory-after-1440x900-en-light.png` | Team cards `/admin/team` | Admin, EN light LTR, 1440×900 | 1440×900 / 1425 / 1425 / 1425 | pass |
| `after/admin-team-member-after-1440x900-en-light.png` | Team overview `/admin/team/175` | Admin, EN light LTR, 1440×900 | bounded | pass |
| `after/admin-users-after-1440x900-en-light.png` | Users list `/admin/users` | Admin, EN light LTR, 1440×900 | 1440×900 / 1425 / 1425 / 1425 | pass |
| `after/admin-schedules-after-1024x900-en-dark.png` | Schedule `/admin/doctors` | Admin, EN dark LTR, 1024×900 | 1024×900 / 1009 / 1009 / 1009 | pass |
| `after/admin-leave-after-1024x900-en-dark.png` | Leave `/admin/leave` | Admin, EN dark LTR, 1024×900 | 1024×900 / 1009 / 1009 / 1009 | pass |
| `after/staff-team-after-1024x900-en-light.png` | Team `/staff/team` | Staff, EN light LTR, 1024×900 | 1024×900 / 1024 / 1024 / 1024 | read-only pass |
| `after/staff-profile-after-1024x900-en-light.png` | Profile `/staff/profile` | Staff, EN light LTR, 1024×900 | 1024×900 / 1024 / 1024 / 1024 | pass |
| `after/doctor-profile-after-768x1024-ar-light-rtl.png` | Profile `/doctor/profile` | Doctor, AR light RTL, 768×1024 | 768×1024 / 768 / 768 / 768 | pass |

Detailed captures duplicate the corresponding real route state where named in `after/`: Team cards/overview, Users list, Schedule, Leave list, Staff directory/profile, and Doctor profile. Local scroll containers are limited to the existing horizontal table wrappers and tab strips; page overflow is absent.
