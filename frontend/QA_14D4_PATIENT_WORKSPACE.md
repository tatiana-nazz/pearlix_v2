# Phase 14D.4 Patient Workspace Manual QA

Browser QA has not been executed. Verify Admin, Staff, and Doctor at 1440, 1280, 1024, and 768 px in Light, Dark, and System themes, English and Arabic RTL.

| Area | Required verification |
| --- | --- |
| Directory | Loading, populated, empty, retry, background refresh, server pagination, trimmed search, clear filters, long Arabic names, active/archived status, and keyboard row navigation. |
| Creation | Staff-only route, General Information only, gender select, no submitted age, validation, duplicate response, dirty cancellation, duplicate-submit prevention, success navigation. |
| Detail | Direct URL, read-first text presentation, formatted dates/age, missing values, tab URL fallback, related summaries, and timestamps. |
| Editing | Explicit General Information and Medical History edit modes, field preservation, stale-version conflict, Reload latest, local-value review, and cache refresh. |
| Archive | Staff confirmation, blocked archive error, archive/reactivate state, appointment-picker exclusion, and no hard delete. |
| Access | Admin read-only, Staff actions, Doctor access to every active/non-archived patient (not assigned-only), archived direct-URL denial, role-sensitive related links. |
| Accessibility | Heading order, table rows, focus, tabs with arrows/Home/End, labels/errors, modal Escape/focus return, 200% zoom, and RTL reading order. |

Browser QA status: pending execution.

Doctor helper filters (`my_patients`, upcoming, and last visit) narrow the workflow list only; they do not restrict canonical object access. Phase 14D.4A automated coverage adds exact create payload/no derived age, dirty cancellation, keyboard row activation, tab Home/End associations, direct Doctor billing-tab fallback, and versioned mutation invalidation. Browser QA remains a separate pending gate.
