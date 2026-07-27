import { Link } from "react-router-dom";

import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { LoadingState } from "../../components/LoadingState";
import { PageHeader } from "../../components/PageHeader";
import { StatusPill } from "../../components/StatusPill";
import { useActiveVisit } from "../../features/visits/hooks/useVisits";
import { VisitWorkspace } from "../../features/visits/components/VisitWorkspace";
import { visitCopy } from "../../features/visits/i18n";
import { useAuthStore } from "../../auth/authStore";
import { formatTime } from "../../utils/dates";

export function DoctorActiveVisitPage() {
  const activeVisit = useActiveVisit();
  const c = visitCopy(useAuthStore((state) => state.user?.language_preference));
  const title = c.activeVisit === "Active visit" ? "Active Visit" : c.activeVisit;

  return (
    <div className="visit-page">
      <PageHeader title={title} description={activeVisit.data ? `${activeVisit.data.patient.full_name} · ${activeVisit.data.appointment.reason || c.activeVisitDescription}` : c.activeVisitDescription} actions={activeVisit.data ? <div className="active-visit-page-actions"><div className="active-visit-page-status"><StatusPill status={activeVisit.data.status} /><span>{c.inVisit}</span><small>{c.started} {formatTime(activeVisit.data.started_at)}</small></div><Link className="button secondary" to="/doctor/appointments/day">{c.backAppointments}</Link></div> : undefined} />
      {activeVisit.isLoading ? <LoadingState title={c.loadingActive} /> : null}
      {activeVisit.isError ? <ErrorState error={activeVisit.error} onRetry={() => void activeVisit.refetch()} title={c.loadActiveError} /> : null}
      {activeVisit.data ? <VisitWorkspace role="DOCTOR" visit={activeVisit.data} onReloadVisit={() => activeVisit.refetch()} /> : null}
      {activeVisit.data === null ? (
        <div className="state-panel">
          <div><h3>{c.noActive}</h3><EmptyState title={c.noActiveDescription} /></div>
          <Link className="button primary" to="/doctor/appointments/day">{c.openAppointments}</Link>
        </div>
      ) : null}
    </div>
  );
}
