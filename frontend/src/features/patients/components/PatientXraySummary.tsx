import { useState } from "react";
import { useNavigate } from "react-router-dom";

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
import { XrayUploadDialog } from "../../xrays/components/XrayUploadDialog";
import { usePatientXrayUpload } from "../../xrays/hooks/useXrays";
import { canUploadPatientXray } from "../../xrays/utils/xrayPermissions";

interface PatientXraySummaryProps {
  role: UserRole;
  patientId: number;
  xrays?: Page<XrayAttachment>;
  aiResults?: Page<AIResult>;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
}

export function PatientXraySummary({ role, patientId, xrays, aiResults, isLoading, error, onRetry }: PatientXraySummaryProps) {
  const navigate = useNavigate();
  const upload = usePatientXrayUpload(patientId);
  const [uploadOpen, setUploadOpen] = useState(false);
  if (isLoading) return <LoadingState title="Loading X-rays and AI results..." />;
  if (error) return <ErrorState error={error} onRetry={onRetry} title="Unable to load X-rays" />;
  const xrayRows = xrays?.results ?? [];
  const aiRows = aiResults?.results ?? [];

  return (
    <Card>
      <SectionHeader title="X-rays & AI" description="Saved X-rays and existing AI results. Protected media is available only from authenticated detail screens." />
      {canUploadPatientXray(role) ? <div className="schedule-actions"><button className="button secondary" type="button" onClick={() => { upload.reset(); setUploadOpen(true); }}>Upload patient X-ray</button></div> : null}
      {xrayRows.length ? (
        <ul className="summary-list-flat">
          {xrayRows.map((xray) => {
            const open = () => navigate(`/${role.toLowerCase()}/xrays/${xray.id}`);
            return <li className="summary-row clickable-row" key={xray.id} tabIndex={0} aria-label={`Open X-ray ${displayText(xray.title, xray.original_file_name)}`} onClick={open} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); } }}>
              <div>
                <strong>{displayText(xray.title, xray.original_file_name)}</strong>
                <span>
                  {xray.source.replace("_", " ")} · {formatDateTime(xray.created_at)}
                </span>
                <span>{xray.has_ai_result ? "AI result available" : "No AI result saved"}</span>
              </div>
            </li>;
          })}
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
      {uploadOpen ? <XrayUploadDialog title="Upload patient X-ray" isSubmitting={upload.isPending} error={upload.error} onCancel={() => setUploadOpen(false)} onSubmit={(payload) => void upload.mutateAsync(payload).then(() => setUploadOpen(false))} /> : null}
    </Card>
  );
}
