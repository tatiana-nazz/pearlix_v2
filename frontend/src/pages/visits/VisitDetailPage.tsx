import { useLocation, useParams } from "react-router-dom";

import { BackLink } from "../../components/BackLink";
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
  const location = useLocation();
  const { visitId } = useParams();
  const parsedVisitId = Number(visitId);
  const visit = useVisit(parsedVisitId);
  const c = visitCopy(useAuthStore((state) => state.user?.language_preference));
  const activeTitle = c.activeVisit === "Active visit" ? "Active Visit" : c.activeVisit;
  const openedFromPatient = (location.state as { visitParent?: string } | null)?.visitParent === "patient";
  const patientVisitsPath = visit.data ? `/${role.toLowerCase()}/patients/${visit.data.patient.id}?tab=visits` : `/${role.toLowerCase()}/patients`;

  return (
    <div className="visit-page">
      <BackLink to={patientVisitsPath}>{openedFromPatient ? c.backToPatient : c.backToVisits}</BackLink>
      <PageHeader title={visit.data?.status === "ACTIVE" ? activeTitle : c.visitDetails} description={visit.data ? `${visit.data.patient.full_name} · ${c.visitDetailsDescription}` : c.visitDetailsDescription} />
      {visit.isLoading ? <LoadingState title={c.loadingDetails} /> : null}
      {visit.isError ? <ErrorState error={visit.error} onRetry={() => void visit.refetch()} title={c.loadDetailsError} /> : null}
      {visit.data ? <VisitWorkspace role={role} visit={visit.data} onReloadVisit={() => visit.refetch()} /> : null}
    </div>
  );
}
