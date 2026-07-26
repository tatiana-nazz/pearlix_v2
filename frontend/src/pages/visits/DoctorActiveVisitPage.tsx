import { Link } from "react-router-dom";

import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { LoadingState } from "../../components/LoadingState";
import { PageHeader } from "../../components/PageHeader";
import { useActiveVisit } from "../../features/visits/hooks/useVisits";
import { VisitWorkspace } from "../../features/visits/components/VisitWorkspace";
import { visitCopy } from "../../features/visits/i18n";
import { useAuthStore } from "../../auth/authStore";

export function DoctorActiveVisitPage() {
  const activeVisit = useActiveVisit();
  const c = visitCopy(useAuthStore((state) => state.user?.language_preference));
  const title = c.activeVisit === "Active visit" ? "Active Visit" : c.activeVisit;

  return (
    <div className="visit-page">
      <PageHeader title={title} description={activeVisit.data ? `${activeVisit.data.patient.full_name} · ${c.activeVisitDescription}` : c.activeVisitDescription} />
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
