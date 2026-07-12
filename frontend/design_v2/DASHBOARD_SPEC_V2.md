# Dashboard Specification v2

Dashboards currently duplicate navigation, show technical/placeholder copy, long flat queues, and empty equal cards. They must deliver quick information and quick access above the fold. KPI/queue links preserve filters in URL; preview lists render 4–6 rows, total count, Show more, Collapse, and View all when a route exists—never fetch all records merely to expand.

| Role | 3–5 KPIs | Priority work + quick actions | Acceptance |
| --- | --- | --- | --- |
| Admin | active patients, today appointments, needs reschedule, pending handoffs, unpaid invoices | attention queue; recent audit; `Clinic settings` or `Users & Access` only | supervisory records are read-only; KPI/card opens exact allowed queue. |
| Staff | today appointments, checked in, needs reschedule, pending handoffs, unpaid/partial invoices | upcoming/check-in, reschedule, billing queue, recent patients; `New appointment`, `Find patient` | no placeholder route text; queue rows open appointment/patient/handoff detail. |
| Doctor | today appointments, checked-in, active visit, needs reschedule, completed today | active visit/next patient, schedule, recent visits, own handoffs; `Resume/Start visit` only when valid | no invoice/payment action; exact own-data restriction retained. |

At 1440 use up to 5 KPIs and a 8/4 or 7/5 content split; 1280 remains 4/1 or 3/2; 1024 KPIs two columns, priority/content stack when below 620 px available; 768 one/two-column items with no nested scroll. Each populated/empty/loading/error state respects role. Urgent counts have label plus warning icon; a zero KPI remains actionable but subdued.
