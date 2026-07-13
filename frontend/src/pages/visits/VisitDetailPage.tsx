import { useParams } from "react-router-dom";

import { ApiClientError } from "../../api/errors";
import { Button, PageHeaderV2, StatePanel } from "../../components/v2";
import { VisitWorkspace } from "../../features/visits/components/VisitWorkspace";
import { useVisit } from "../../features/visits/hooks/useVisits";
import { useFeatureT } from "../../layouts/i18n";
import type { UserRole } from "../../types/auth";

interface VisitDetailPageProps { role: UserRole; }

export function VisitDetailPage({ role }: VisitDetailPageProps) {
  const t = useFeatureT();
  const { visitId } = useParams();
  const visit = useVisit(Number(visitId));
  const code = visit.error instanceof ApiClientError ? visit.error.code : undefined;
  const state = code === "PERMISSION_DENIED" ? "denied" : code === "NOT_FOUND" ? "notFound" : "error";
  const title = state === "denied" ? t("visitAccessDenied") : state === "notFound" ? t("visitNotFound") : t("visitUnavailable");
  return <div className="visit-page"><PageHeaderV2 title={t("visitDetails")} description={t("visitDetailsDescription")} />
    {visit.isLoading ? <StatePanel state="loading" title={t("loadingVisit")} /> : null}
    {visit.isError ? <StatePanel state={state} title={title} action={<Button type="button" variant="secondary" onClick={() => void visit.refetch()}>{t("retry")}</Button>} /> : null}
    {visit.data ? <VisitWorkspace role={role} visit={visit.data} /> : null}
  </div>;
}
