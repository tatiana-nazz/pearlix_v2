import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { getStaffDashboard } from "../../api/endpoints/dashboard";
import { Card } from "../../components/Card";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { LoadingState } from "../../components/LoadingState";
import { PageHeader } from "../../components/PageHeader";
import { SectionHeader } from "../../components/SectionHeader";
import { StatCard } from "../../components/StatCard";
import { StatusPill } from "../../components/StatusPill";
import { SummaryList } from "../../components/SummaryList";
import type {
  DashboardAppointmentSummary,
  DashboardAvailabilityExceptionSummary,
  DashboardBillingHandoffSummary,
  DashboardInvoiceSummary,
  DashboardPatientSummary,
  DashboardWorkingHourSummary,
} from "../../types/dashboard";
import { formatClock, formatDateRange, formatWeekday } from "../../utils/dates";
import { displayText, formatCount, formatCurrencyAmount } from "../../utils/formatters";

function appointmentRow(item: DashboardAppointmentSummary) {
  return (
    <li className="summary-row" key={item.id}>
      <div>
        <strong>{item.patient.full_name}</strong>
        <span>{formatDateRange(item.start_datetime, item.end_datetime)}</span>
        <span>
          {item.doctor.full_name} - {displayText(item.reason, "No reason recorded")}
        </span>
      </div>
      <StatusPill status={item.status} />
    </li>
  );
}

function handoffRow(item: DashboardBillingHandoffSummary) {
  return (
    <li className="summary-row" key={item.id}>
      <div>
        <strong>{item.patient.full_name}</strong>
        <span>Visit #{item.visit_id}</span>
        <span>{formatCurrencyAmount(item.suggested_amount, item.currency)}</span>
      </div>
      <StatusPill status={item.status} />
    </li>
  );
}

function invoiceRow(item: DashboardInvoiceSummary) {
  return (
    <li className="summary-row" key={item.id}>
      <div>
        <strong>{item.invoice_number}</strong>
        <span>{item.patient.full_name}</span>
        <span>Remaining {formatCurrencyAmount(item.remaining_amount, item.currency)}</span>
      </div>
      <StatusPill status={item.status} />
    </li>
  );
}

function patientRow(item: DashboardPatientSummary) {
  return (
    <li className="summary-row compact" key={item.id}>
      <div>
        <strong>{item.full_name}</strong>
        <span>{displayText(item.phone_number, "No phone recorded")}</span>
      </div>
    </li>
  );
}

function availabilityRow(item: DashboardAvailabilityExceptionSummary) {
  const person = item.doctor?.full_name ?? item.staff?.full_name ?? "Team member";
  return (
    <li className="summary-row compact" key={item.id}>
      <div>
        <strong>{person}</strong>
        <span>{formatDateRange(item.start_datetime, item.end_datetime)}</span>
        <span>{displayText(item.reason, "No reason recorded")}</span>
      </div>
      <StatusPill status={item.type} tone={item.is_cancelled ? "danger" : "attention"} />
    </li>
  );
}

function workingHourRow(item: DashboardWorkingHourSummary) {
  return (
    <li className="summary-row compact" key={item.id}>
      <div>
        <strong>{formatWeekday(item.weekday)}</strong>
        <span>
          {formatClock(item.start_time)} - {formatClock(item.end_time)}
        </span>
      </div>
      <StatusPill status={item.is_active ? "ACTIVE" : "INACTIVE"} tone={item.is_active ? "success" : "default"} />
    </li>
  );
}

export function StaffDashboardPage() {
  const dashboard = useQuery({
    queryKey: ["dashboard", "staff"],
    queryFn: getStaffDashboard,
  });

  if (dashboard.isLoading) return <LoadingState title="Loading staff dashboard..." />;
  if (dashboard.isError) return <ErrorState error={dashboard.error} onRetry={() => void dashboard.refetch()} />;
  if (!dashboard.data) return <EmptyState title="No staff dashboard data was returned." />;

  const data = dashboard.data;

  return (
    <div className="dashboard-page">
      <PageHeader
        eyebrow="Staff dashboard"
        title="Front desk operations"
        description="Queue-focused work from the backend staff dashboard endpoint."
        actions={
          <Link className="button secondary" to="/staff/appointments/needs-reschedule">
            Needs Reschedule
          </Link>
        }
      />

      <div className="dashboard-grid">
        <StatCard label="Today's appointments" value={formatCount(data.today_appointments_count)} description="Clinic schedule" />
        <StatCard label="Checked in" value={formatCount(data.checked_in_appointments.length)} description="Ready for Doctor" tone="success" />
        <StatCard
          label="Needs reschedule"
          value={formatCount(data.needs_reschedule_appointments.length)}
          description="Requires Staff follow-up"
          tone={data.needs_reschedule_appointments.length ? "attention" : "default"}
        />
        <StatCard
          label="Pending handoffs"
          value={formatCount(data.pending_billing_handoffs.length)}
          description="Billing queue"
          tone={data.pending_billing_handoffs.length ? "attention" : "default"}
        />
      </div>

      <Card className="operations-panel">
        <SectionHeader title="Operations queues" description="Dashboard links lead to placeholder route shells until later workflow phases." />
        <div className="queue-grid">
          <SummaryList
            title="Upcoming today"
            items={data.upcoming_today_appointments}
            emptyMessage="No upcoming appointments are waiting today."
            renderItem={appointmentRow}
          />
          <SummaryList
            title="Checked-in appointments"
            items={data.checked_in_appointments}
            emptyMessage="No patients are checked in."
            renderItem={appointmentRow}
          />
          <SummaryList
            title="Needs reschedule"
            items={data.needs_reschedule_appointments}
            emptyMessage="No appointments need rescheduling."
            renderItem={appointmentRow}
          />
          <SummaryList
            title="Pending billing handoffs"
            items={data.pending_billing_handoffs}
            emptyMessage="No billing handoffs are waiting."
            renderItem={handoffRow}
          />
          <SummaryList
            title="Unpaid invoices"
            items={data.unpaid_or_partially_paid_invoices}
            emptyMessage="No unpaid or partially paid invoices were returned."
            renderItem={invoiceRow}
          />
          <SummaryList
            title="Recent patients"
            items={data.recent_patients}
            emptyMessage="No recent patients were returned."
            renderItem={patientRow}
          />
        </div>
      </Card>

      <div className="dashboard-columns">
        <Card>
          <SummaryList
            title="Own schedule summary"
            description="Staff schedule data appears here when the backend returns it."
            items={data.own_working_schedule}
            emptyMessage="No staff working schedule was returned."
            renderItem={workingHourRow}
          />
        </Card>
        <Card>
          <SummaryList
            title="Own leave summary"
            description="Staff leave is visibility-only in the MVP."
            items={data.own_availability_exceptions}
            emptyMessage="No own leave records were returned."
            renderItem={availabilityRow}
          />
        </Card>
        <Card>
          <SummaryList
            title="Doctor unavailable blocks"
            description="Reference for scheduling and rescheduling decisions."
            items={data.doctor_unavailable_exceptions}
            emptyMessage="No doctor unavailable blocks were returned."
            renderItem={availabilityRow}
          />
        </Card>
      </div>
    </div>
  );
}
