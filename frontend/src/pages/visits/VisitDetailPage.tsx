import { useParams } from "react-router-dom";

import { ErrorState } from "../../components/ErrorState";
import { LoadingState } from "../../components/LoadingState";
import { PageHeader } from "../../components/PageHeader";
import { VisitWorkspace } from "../../features/visits/components/VisitWorkspace";
import { useVisit } from "../../features/visits/hooks/useVisits";
import { visitCopy } from "../../features/visits/i18n";
import type { UserRole } from "../../types/auth";
import { useAuthStore } from "../../auth/authStore";

interface VisitDetailPageProps { role: UserRole; }

export function VisitDetailPage({ role }: VisitDetailPageProps) {
  const { visitId } = useParams();
  const parsedVisitId = Number(visitId);
  const visit = useVisit(parsedVisitId);
  const c = visitCopy(useAuthStore((state) => state.user?.language_preference));

  return (
    <div className="visit-page">
      <PageHeader eyebrow={`${role.toLowerCase()} workspace`} title={visit.data?.patient.full_name ?? c.visitDetails} description={c.visitDetailsDescription} />
      {visit.isLoading ? <LoadingState title={c.loadingDetails} /> : null}
      {visit.isError ? <ErrorState error={visit.error} onRetry={() => void visit.refetch()} title={c.loadDetailsError} /> : null}
      {visit.data ? <VisitWorkspace role={role} visit={visit.data} onReloadVisit={() => visit.refetch()} /> : null}
    </div>
  );
}
