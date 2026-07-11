import { Link } from "react-router-dom";

import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { LoadingState } from "../../components/LoadingState";
import { PageHeader } from "../../components/PageHeader";
import { useActiveVisit } from "../../features/visits/hooks/useVisits";
import { VisitWorkspace } from "../../features/visits/components/VisitWorkspace";

export function DoctorActiveVisitPage() {
  const activeVisit = useActiveVisit();

  return (
    <div className="visit-page">
      <PageHeader eyebrow="doctor workspace" title="Active Visit" description="Document the current clinical encounter and complete it when care is finished." />
      {activeVisit.isLoading ? <LoadingState title="Loading active visit..." /> : null}
      {activeVisit.isError ? <ErrorState error={activeVisit.error} onRetry={() => void activeVisit.refetch()} title="Unable to load active visit" /> : null}
      {activeVisit.data ? <VisitWorkspace role="DOCTOR" visit={activeVisit.data} /> : null}
      {activeVisit.data === null ? (
        <div className="state-panel">
          <div><h3>No active visit</h3><EmptyState title="Start a checked-in appointment to begin documenting a visit." /></div>
          <Link className="button primary" to="/doctor/appointments/day">Open appointments</Link>
        </div>
      ) : null}
    </div>
  );
}
