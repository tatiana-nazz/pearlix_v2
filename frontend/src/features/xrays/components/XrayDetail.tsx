import { Link } from "react-router-dom";

import { Card } from "../../../components/Card";
import { ErrorState } from "../../../components/ErrorState";
import { StatusPill } from "../../../components/StatusPill";
import type { UserRole } from "../../../types/auth";
import type { XrayAttachment } from "../../../types/xrays";
import { formatDateTime } from "../../../utils/dates";
import { displayText } from "../../../utils/formatters";
import { useRunSavedXrayAi, useXrayAiResult } from "../hooks/useXrays";
import { canRunSavedXrayAi } from "../utils/xrayPermissions";
import { formatFileSize } from "../utils/xrayValidation";
import { AiResultPanel } from "./AiResultPanel";
import { ProtectedXrayImage } from "./ProtectedXrayImage";

interface XrayDetailProps { role: UserRole; xray: XrayAttachment; }

export function XrayDetail({ role, xray }: XrayDetailProps) {
  const aiResult = useXrayAiResult(xray.id, xray.has_ai_result);
  const runAi = useRunSavedXrayAi(xray.id);
  const canRun = canRunSavedXrayAi(role, xray);
  return <div className="xray-detail-grid">
    <Card><div className="visit-summary-header"><div><p className="eyebrow">Saved X-ray</p><h3>{displayText(xray.title, xray.original_file_name)}</h3></div><StatusPill status={xray.has_ai_result ? "AI AVAILABLE" : "AI NOT RUN"} /></div>
      <ProtectedXrayImage endpoint={xray.file_endpoint} label="Original X-ray" alt="Protected saved dental X-ray" />
      <dl className="detail-grid"><div><dt>Patient</dt><dd><Link to={`/${role.toLowerCase()}/patients/${xray.patient.id}`}>{xray.patient.full_name}</Link></dd></div><div><dt>Source</dt><dd>{xray.source.replace(/_/g, " ")}</dd></div><div><dt>Visit</dt><dd>{xray.visit ? `Visit #${xray.visit.id}` : "Patient profile"}</dd></div><div><dt>File</dt><dd>{xray.content_type} · {formatFileSize(xray.size_bytes)}</dd></div><div><dt>Uploaded by</dt><dd>{xray.uploaded_by.full_name}</dd></div><div><dt>Uploaded</dt><dd>{formatDateTime(xray.created_at)}</dd></div><div className="detail-wide"><dt>Notes</dt><dd>{displayText(xray.notes)}</dd></div></dl>
      {canRun ? <div className="xray-run-ai"><button className="button primary" type="button" disabled={runAi.isPending} onClick={() => void runAi.mutateAsync()}>{runAi.isPending ? "Running AI..." : "Run AI"}</button>{runAi.error ? <ErrorState error={runAi.error} title="AI run unavailable" /> : null}</div> : null}
    </Card>
    <AiResultPanel result={runAi.data ?? aiResult.data} isLoading={aiResult.isLoading} error={aiResult.error} overlayEndpoint={xray.ai_overlay_endpoint} onRetry={() => void aiResult.refetch()} />
  </div>;
}
