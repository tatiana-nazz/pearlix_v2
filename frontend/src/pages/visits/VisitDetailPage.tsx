import { useParams } from "react-router-dom";

import { ErrorState } from "../../components/ErrorState";
import { LoadingState } from "../../components/LoadingState";
import { PageHeader } from "../../components/PageHeader";
import { VisitWorkspace } from "../../features/visits/components/VisitWorkspace";
import { useVisit } from "../../features/visits/hooks/useVisits";
import type { UserRole } from "../../types/auth";

interface VisitDetailPageProps { role: UserRole; }

export function VisitDetailPage({ role }: VisitDetailPageProps) {
  const { visitId } = useParams();
  const parsedVisitId = Number(visitId);
  const visit = useVisit(parsedVisitId);

  return (
    <div className="visit-page">
      <PageHeader eyebrow={`${role.toLowerCase()} workspace`} title="Visit Details" description="Review the appointment context and clinical documentation for this visit." />
      {visit.isLoading ? <LoadingState title="Loading visit details..." /> : null}
      {visit.isError ? <ErrorState error={visit.error} onRetry={() => void visit.refetch()} title="Unable to load visit details" /> : null}
      {visit.data ? <VisitWorkspace role={role} visit={visit.data} /> : null}
    </div>
  );
}
