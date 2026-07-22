import { useState } from "react";
import { Link } from "react-router-dom";

import { Card } from "../../../components/Card";
import { EmptyState } from "../../../components/EmptyState";
import { ErrorState } from "../../../components/ErrorState";
import { LoadingState } from "../../../components/LoadingState";
import { SectionHeader } from "../../../components/SectionHeader";
import { StatusPill } from "../../../components/StatusPill";
import { useFeatureT } from "../../../layouts/i18n";
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
  const t = useFeatureT();
  const upload = usePatientXrayUpload(patientId);
  const [uploadOpen, setUploadOpen] = useState(false);
  if (isLoading) return <LoadingState title={t("loadingXrays")} />;
  if (error) return <ErrorState error={error} onRetry={onRetry} title={t("xrayUnavailable")} />;
  const xrayRows = xrays?.results ?? [];
  const aiRows = aiResults?.results ?? [];

  return (
    <Card>
      <SectionHeader title={t("xraysAi")} description={t("xrayDetailsDescription")} />
      {canUploadPatientXray(role) ? <div className="schedule-actions"><button className="button secondary" type="button" onClick={() => { upload.reset(); setUploadOpen(true); }}>{t("uploadXray")}</button></div> : null}
      {xrayRows.length ? (
        <ul className="summary-list-flat">
          {xrayRows.map((xray) => (
            <li className="summary-row" key={xray.id}>
              <div>
                <strong>{displayText(xray.title, xray.original_file_name)}</strong>
                <span>
                  {xray.source.replace("_", " ")} · {formatDateTime(xray.created_at)}
                </span>
                <span>{xray.has_ai_result ? t("aiAvailable") : t("aiNotRun")}</span>
              </div>
              <Link className="button secondary compact-button" to={`/${role.toLowerCase()}/xrays/${xray.id}`}>
                {t("openXray")}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title={t("noSavedXrays")} />
      )}

      <div className="subsection">
        <h3>{t("aiResult")}</h3>
        {aiRows.length ? (
          <ul className="summary-list-flat">
            {aiRows.map((result) => (
              <li className="summary-row" key={result.id}>
                <div>
                  <strong>{displayText(result.result_summary, t("aiResult"))}</strong>
                  <span>{formatDateTime(result.created_at)}</span>
                </div>
                <StatusPill status={result.status} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title={t("noAiResult")} />
        )}
      </div>
      {uploadOpen ? <XrayUploadDialog title={t("uploadXray")} isSubmitting={upload.isPending} error={upload.error} onCancel={() => setUploadOpen(false)} onSubmit={(payload) => void upload.mutateAsync(payload).then(() => setUploadOpen(false))} /> : null}
    </Card>
  );
}
