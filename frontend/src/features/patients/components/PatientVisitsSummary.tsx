import { useNavigate } from "react-router-dom";

import { Card } from "../../../components/Card";
import { ClickableSummaryRow } from "../../../components/v2";
import { EmptyState } from "../../../components/EmptyState";
import { ErrorState } from "../../../components/ErrorState";
import { LoadingState } from "../../../components/LoadingState";
import { SectionHeader } from "../../../components/SectionHeader";
import { StatusPill } from "../../../components/StatusPill";
import { useFeatureT } from "../../../layouts/i18n";
import type { Page } from "../../../types/api";
import type { UserRole } from "../../../types/auth";
import type { VisitDetail } from "../../../types/visits";
import { formatDateRange } from "../../../utils/dates";
import { displayText } from "../../../utils/formatters";

interface PatientVisitsSummaryProps {
  role: UserRole;
  visits?: Page<VisitDetail>;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
}

export function PatientVisitsSummary({ role, visits, isLoading, error, onRetry }: PatientVisitsSummaryProps) {
  const t = useFeatureT(); const navigate = useNavigate();
  if (isLoading) return <LoadingState title={t("loadingVisits")} />;
  if (error) return <ErrorState error={error} onRetry={onRetry} title={t("unableToLoadVisits")} />;
  const rows = visits?.results ?? [];
  return <Card><SectionHeader title={t("visits")} description={t("clinicalHistoryDescription")} />
    {rows.length ? <ul className="summary-list-flat">{rows.map((visit) => <ClickableSummaryRow key={visit.id} ariaLabel={`${visit.doctor.full_name}: ${formatDateRange(visit.started_at, visit.completed_at)}`} onOpen={() => navigate(`/${role.toLowerCase()}/visits/${visit.id}`)}><div><strong className="bidi-isolate">{formatDateRange(visit.started_at, visit.completed_at)}</strong><span className="bidi-isolate">{visit.doctor.full_name}</span><span>{t("diagnosis")}: {displayText(visit.diagnosis, t("notRecorded"))} · {t("treatment")}: {displayText(visit.treatment, t("notRecorded"))}</span></div><div><StatusPill status={visit.status} /></div></ClickableSummaryRow>)}</ul> : <EmptyState title={t("noVisitsRecorded")} />}
    {visits && visits.count > rows.length ? <p className="panel-note">{t("showingCount")} <bdi>{rows.length}</bdi> {t("of")} <bdi>{visits.count}</bdi>.</p> : null}
  </Card>;
}
