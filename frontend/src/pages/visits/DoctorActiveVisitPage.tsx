import { Link } from "react-router-dom";

import { Button, PageHeaderV2, StatePanel } from "../../components/v2";
import { ApiClientError } from "../../api/errors";
import { VisitWorkspace } from "../../features/visits/components/VisitWorkspace";
import { useActiveVisit } from "../../features/visits/hooks/useVisits";
import { useFeatureT } from "../../layouts/i18n";

export function DoctorActiveVisitPage() {
  const t = useFeatureT();
  const activeVisit = useActiveVisit();
  const denied = activeVisit.error instanceof ApiClientError && activeVisit.error.code === "PERMISSION_DENIED";
  return <div className="visit-page active-visit-page"><PageHeaderV2 title={t("activeVisit")} description={t("activeVisitDescription")} />
    {activeVisit.isLoading ? <StatePanel state="loading" title={t("loadingVisit")} /> : null}
    {activeVisit.isError ? <StatePanel state={denied ? "denied" : "error"} title={denied ? t("visitAccessDenied") : t("visitUnavailable")} action={<Button type="button" variant="secondary" onClick={() => void activeVisit.refetch()}>{t("retry")}</Button>} /> : null}
    {activeVisit.data ? <VisitWorkspace role="DOCTOR" visit={activeVisit.data} onReloadVisit={() => activeVisit.refetch()} /> : null}
    {activeVisit.data === null ? <StatePanel state="empty" title={t("noActiveVisit")} description={t("noActiveVisitDescription")} action={<Link className="button primary" to="/doctor/appointments/day">{t("openDayAppointments")}</Link>} /> : null}
  </div>;
}
