import { Link } from "react-router-dom";

import { Card } from "../../../components/Card";
import { EmptyState } from "../../../components/EmptyState";
import { ErrorState } from "../../../components/ErrorState";
import { LoadingState } from "../../../components/LoadingState";
import { SectionHeader } from "../../../components/SectionHeader";
import { StatusPill } from "../../../components/StatusPill";
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
  title?: string;
  description?: string;
}

export function PatientVisitsSummary({ role, visits, isLoading, error, onRetry, title = "Visits", description = "Clinical history for this patient. Access is read-only unless you are the doctor who owns the visit." }: PatientVisitsSummaryProps) {
  if (isLoading) return <LoadingState title="Loading visits..." />;
  if (error) return <ErrorState error={error} onRetry={onRetry} title="Unable to load visits" />;
  const rows = visits?.results ?? [];

  return (
    <Card>
      <SectionHeader title={title} description={description} />
      {rows.length ? (
        <ul className="summary-list-flat">
          {rows.map((visit) => (
            <li className="summary-row" key={visit.id}>
              <div>
                <strong>{formatDateRange(visit.started_at, visit.completed_at)}</strong>
                <span>{visit.doctor.full_name}</span>
                <span>
                  Diagnosis: {displayText(visit.diagnosis, "Not recorded")} · Treatment: {displayText(visit.treatment, "Not recorded")}
                </span>
              </div>
              <div className="row-actions">
                <StatusPill status={visit.status} />
                <Link className="button secondary compact-button" to={`/${role.toLowerCase()}/visits/${visit.id}`} state={{ visitParent: "patient" }}>
                  Open Visit
                </Link>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="No visits have been recorded for this patient." />
      )}
      {visits && visits.count > rows.length ? <p className="panel-note">Showing {rows.length} of {visits.count} visits.</p> : null}
    </Card>
  );
}
