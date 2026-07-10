import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { getAdminDashboard } from "../../api/endpoints/dashboard";
import { Card } from "../../components/Card";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { LoadingState } from "../../components/LoadingState";
import { PageHeader } from "../../components/PageHeader";
import { SectionHeader } from "../../components/SectionHeader";
import { StatCard } from "../../components/StatCard";
import { StatusPill } from "../../components/StatusPill";
import { SummaryList } from "../../components/SummaryList";
import type { DashboardAppointmentSummary, DashboardInvoiceSummary } from "../../types/dashboard";
import { formatDateRange } from "../../utils/dates";
import { formatCount, formatCurrencyAmount, displayText } from "../../utils/formatters";

function renderAppointment(item: DashboardAppointmentSummary) {
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

function renderInvoice(item: DashboardInvoiceSummary) {
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

export function AdminDashboardPage() {
  const dashboard = useQuery({
    queryKey: ["dashboard", "admin"],
    queryFn: getAdminDashboard,
  });

  if (dashboard.isLoading) return <LoadingState title="Loading admin dashboard..." />;
  if (dashboard.isError) return <ErrorState error={dashboard.error} onRetry={() => void dashboard.refetch()} />;
  if (!dashboard.data) return <EmptyState title="No admin dashboard data was returned." />;

  const data = dashboard.data;

  return (
    <div className="dashboard-page">
      <PageHeader
        eyebrow="Admin dashboard"
        title="Clinic operations overview"
        description="Read-only operational status from the backend admin dashboard endpoint."
        actions={
          <Link className="button secondary" to="/admin/clinic-settings">
            Clinic settings
          </Link>
        }
      />

      <div className="dashboard-grid">
        <StatCard label="Active patients" value={formatCount(data.total_active_patients)} description="Currently visible records" />
        <StatCard label="Today's appointments" value={formatCount(data.today_appointments_count)} description="All clinic appointments" />
        <StatCard
          label="Needs reschedule"
          value={formatCount(data.needs_reschedule_appointments_count)}
          description="Created by availability changes"
          tone={data.needs_reschedule_appointments_count ? "attention" : "default"}
        />
        <StatCard
          label="Pending handoffs"
          value={formatCount(data.pending_billing_handoffs_count)}
          description="Awaiting Staff review"
          tone={data.pending_billing_handoffs_count ? "attention" : "default"}
        />
      </div>

      <div className="dashboard-columns">
        <Card>
          <SummaryList
            title="Recent appointments"
            description="Latest appointment activity across the clinic."
            items={data.recent_appointments}
            emptyMessage="No recent appointments were returned."
            renderItem={renderAppointment}
          />
        </Card>

        <Card>
          <SummaryList
            title="Recent invoices"
            description="Read-only billing visibility for clinic supervision."
            items={data.recent_invoices}
            emptyMessage="No recent invoices were returned."
            renderItem={renderInvoice}
          />
        </Card>
      </div>

      <Card className="dashboard-note">
        <SectionHeader title="Clinic note" description="Admin dashboard records are supervisory in this phase." />
        <p>
          Checked-in appointments: <strong>{formatCount(data.checked_in_appointments_count)}</strong>. Active visits:{" "}
          <strong>{formatCount(data.active_visits_count)}</strong>. Unpaid invoices:{" "}
          <strong>{formatCount(data.unpaid_invoices_count)}</strong>.
        </p>
      </Card>
    </div>
  );
}
