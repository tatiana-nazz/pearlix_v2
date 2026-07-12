# Form and Input Specification v2

Forms currently waste width and expose raw/constrained values as free text. Controls are 44 px, labels 13/18 at 8 px above control, help/error 12/18 at 6 px below; errors have icon/text and `aria-describedby`. Desktop uses paired short fields in 2 columns, 20 px gap; 1024/768 uses one column. Dirty state is tracked; Cancel/close asks to discard. Read-only presents values in a definition list, never disabled-looking inputs.

| Domain | Required control |
| --- | --- |
| timezone, language, currency, duration, role, AI mode, statuses | searchable/controlled combobox, segmented control, chips, or select from backend choices |
| gender, blood group, leave type | controlled select/segmented control |
| doctor/staff/patient/visit/appointment | searchable human-labelled combobox; dependent options update; never raw IDs |
| shift/leave/payment time | native or accessible date/time picker with timezone help |
| capacity/amount | constrained numeric control with unit/currency context |

Clinic settings is four efficient sections: Clinic identity/contact; Scheduling policy; Language/currency/appearance; AI configuration. Two columns at 1280/1024 where it remains usable, single at 768, summary cards above, save bar sticky to content bottom. New User remains account-only: name, login email, role, temporary password, must-change explanation; it must not pose as complete Team profile creation.
