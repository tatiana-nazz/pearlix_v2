import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { getDoctorDashboard } from "../../api/endpoints/dashboard";
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
  DashboardVisitSummary,
  DashboardWorkingHourSummary,
} from "../../types/dashboard";
import { formatClock, formatDateRange, formatDateTime, formatWeekday } from "../../utils/dates";
import { displayText, formatCount, formatCurrencyAmount } from "../../utils/formatters";

function appointmentRow(item: DashboardAppointmentSummary) {
  return (
    <li className="summary-row" key={item.id}>
      <div>
        <strong>{item.patient.full_name}</strong>
        <span>{formatDateRange(item.start_datetime, item.end_datetime)}</span>
        <span>{displayText(item.reason, "No reason recorded")}</span>
      </div>
      <StatusPill status={item.status} />
    </li>
  );
}

function visitRow(item: DashboardVisitSummary) {
  return (
    <li className="summary-row" key={item.id}>
      <div>
        <strong>{item.patient.full_name}</strong>
        <span>Appointment #{item.appointment_id}</span>
        <span>
          Started {formatDateTime(item.started_at)}
          {item.completed_at ? ` - Completed ${formatDateTime(item.completed_at)}` : ""}
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

function availabilityRow(item: DashboardAvailabilityExceptionSummary) {
  return (
    <li className="summary-row compact" key={item.id}>
      <div>
        <strong>{formatDateRange(item.start_datetime, item.end_datetime)}</strong>
        <span>{displayText(item.reason, "No reason recorded")}</span>
      </div>
      <StatusPill status={item.type} tone={item.is_cancelled ? "danger" : "attention"} />
    </li>
  );
}

export function DoctorDashboardPage() {
  const dashboard = useQuery({
    queryKey: ["dashboard", "doctor"],
    queryFn: getDoctorDashboard,
  });

  if (dashboard.isLoading) return <LoadingState title="Loading doctor dashboard..." />;
  if (dashboard.isError) return <ErrorState error={dashboard.error} onRetry={() => void dashboard.refetch()} />;
  if (!dashboard.data) return <EmptyState title="No doctor dashboard data was returned." />;

  const data = dashboard.data;

  return (
    <div className="dashboard-page">
      <PageHeader
        eyebrow="Doctor dashboard"
        title="Clinical workspace"
        description="Own appointments, visits, schedule, and handoff visibility from the backend doctor dashboard endpoint."
        actions={
          <Link className="button secondary" to="/doctor/visits/active">
            Active visit
          </Link>
        }
      />

      <Card className="active-visit-card">
        <SectionHeader title="Active visit" description="Only the current doctor's active visit appears here." />
        {data.own_active_visit ? (
          <div className="active-visit-content">
            <div>
              <strong>{data.own_active_visit.patient.full_name}</strong>
              <span>Appointment #{data.own_active_visit.appointment_id}</span>
              <span>Started {formatDateTime(data.own_active_visit.started_at)}</span>
            </div>
            <StatusPill status={data.own_active_visit.status} tone="success" />
          </div>
        ) : (
          <EmptyState title="No active visit was returned." />
        )}
      </Card>

      <div className="dashboard-grid">
        <StatCard label="Today's appointments" value={formatCount(data.today_own_appointments.length)} description="Assigned to you" />
        <StatCard label="Checked in" value={formatCount(data.own_checked_in_appointments.length)} description="Ready to start" tone="success" />
        <StatCard
          label="Needs reschedule"
          value={formatCount(data.own_needs_reschedule_appointments.length)}
          description="Own affected appointments"
          tone={data.own_needs_reschedule_appointments.length ? "attention" : "default"}
        />
        <StatCard
          label="Completed today"
          value={formatCount(data.own_completed_visits_today_count)}
          description="Own completed visits"
          tone="success"
        />
      </div>

      <div className="dashboard-columns">
        <Card>
          <SummaryList
            title="Today appointments"
            items={data.today_own_appointments}
            emptyMessage="No own appointments were returned for today."
            renderItem={appointmentRow}
          />
        </Card>
        <Card>
          <SummaryList
            title="Checked-in appointments"
            items={data.own_checked_in_appointments}
            emptyMessage="No own checked-in appointments were returned."
            renderItem={appointmentRow}
          />
        </Card>
        <Card>
          <SummaryList
            title="Needs reschedule"
            items={data.own_needs_reschedule_appointments}
            emptyMessage="No own appointments need rescheduling."
            renderItem={appointmentRow}
          />
        </Card>
        <Card>
          <SummaryList
            title="Recent visits"
            items={data.own_recent_visits}
            emptyMessage="No own recent visits were returned."
            renderItem={visitRow}
          />
        </Card>
        <Card>
          <SummaryList
            title="Pending billing handoffs"
            description="Doctors can see own handoffs only."
            items={data.own_pending_billing_handoffs}
            emptyMessage="No own billing handoffs are waiting."
            renderItem={handoffRow}
          />
        </Card>
        <Card>
          <SummaryList
            title="Working schedule"
            items={data.own_working_schedule}
            emptyMessage="No working schedule was returned."
            renderItem={workingHourRow}
          />
        </Card>
      </div>

      <Card>
        <SummaryList
          title="Availability and leave"
          description="Own leave is read-only in this dashboard phase."
          items={data.own_availability_exceptions}
          emptyMessage="No own availability exceptions were returned."
          renderItem={availabilityRow}
        />
      </Card>
    </div>
  );
}
