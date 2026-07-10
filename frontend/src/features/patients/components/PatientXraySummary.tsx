import { Link } from "react-router-dom";

import { Card } from "../../../components/Card";
import { EmptyState } from "../../../components/EmptyState";
import { ErrorState } from "../../../components/ErrorState";
import { LoadingState } from "../../../components/LoadingState";
import { SectionHeader } from "../../../components/SectionHeader";
import { StatusPill } from "../../../components/StatusPill";
import type { AIResult } from "../../../types/ai";
import type { Page } from "../../../types/api";
import type { UserRole } from "../../../types/auth";
import type { XrayAttachment } from "../../../types/xrays";
import { formatDateTime } from "../../../utils/dates";
import { displayText } from "../../../utils/formatters";

interface PatientXraySummaryProps {
  role: UserRole;
  xrays?: Page<XrayAttachment>;
  aiResults?: Page<AIResult>;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
}

export function PatientXraySummary({ role, xrays, aiResults, isLoading, error, onRetry }: PatientXraySummaryProps) {
  if (isLoading) return <LoadingState title="Loading X-rays and AI results..." />;
  if (error) return <ErrorState error={error} onRetry={onRetry} title="Unable to load X-rays" />;
  const xrayRows = xrays?.results ?? [];
  const aiRows = aiResults?.results ?? [];

  return (
    <Card>
      <SectionHeader title="X-rays & AI" description="Saved X-ray and AI result summary. Media viewing, upload, AI run, and overlays remain in Phase 13H." />
      {xrayRows.length ? (
        <ul className="summary-list-flat">
          {xrayRows.map((xray) => (
            <li className="summary-row" key={xray.id}>
              <div>
                <strong>{displayText(xray.title, xray.original_file_name)}</strong>
                <span>
                  {xray.source.replace("_", " ")} · {formatDateTime(xray.created_at)}
                </span>
                <span>{xray.has_ai_result ? "AI result available" : "No AI result saved"}</span>
              </div>
              <Link className="button secondary compact-button" to={`/${role.toLowerCase()}/xrays/${xray.id}`}>
                Future Detail
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="No X-rays have been saved for this patient." />
      )}

      <div className="subsection">
        <h3>AI results</h3>
        {aiRows.length ? (
          <ul className="summary-list-flat">
            {aiRows.map((result) => (
              <li className="summary-row" key={result.id}>
                <div>
                  <strong>{displayText(result.result_summary, "AI result")}</strong>
                  <span>{formatDateTime(result.created_at)}</span>
                </div>
                <StatusPill status={result.status} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No AI results have been saved for this patient." />
        )}
      </div>
    </Card>
  );
}
