# Patient Row Specification v2

Patient lists currently lack identity hierarchy and clear interactivity. The approved row is mandatory for Admin, Staff, and Doctor lists.

Desktop columns are Patient (40%), Contact (24%), Last Visit (14%), Next Appointment (16%), Status/chevron (6%); gender/age is beneath name, not a separate prominent column. Patient cell has 36 px initials avatar (photo only when actual backend media exists), dominant full name, and `age · gender` secondary line. Contact groups phone then email. Last/next visit use locale formatting and `—` for absent values. Archive/relevant appointment status is icon + text. The whole row opens authorized profile; Staff row controls never replace row navigation.

At 1024 retain patient/contact/next status, hide last visit only if required. At 768 the row becomes an interactive card: avatar/name/status top, age/gender and contact middle, last/next bottom. It remains one focus target with nested authorized overflow controls. Target is 64 px desktop row minimum / 92 px tablet card minimum, 16 px inset, hover surface, focus ring, logical chevron, and no `View` button. ARIA label includes name and next appointment; sensitive contact is not repeated unnecessarily.
