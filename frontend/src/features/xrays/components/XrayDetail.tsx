import { Link } from "react-router-dom";

import { Card } from "../../../components/Card";
import { StatusPill } from "../../../components/StatusPill";
import type { UserRole } from "../../../types/auth";
import type { XrayAttachment } from "../../../types/xrays";
import { formatDateTime } from "../../../utils/dates";
import { useXrayAiResult } from "../hooks/useXrays";
import { formatFileSize } from "../utils/xrayValidation";
import { aiStatusLabel, xraySourceLabel, xrayText } from "../utils/xrayPresentation";
import { AiResultPanel } from "./AiResultPanel";
import { ProtectedXrayImage } from "./ProtectedXrayImage";

interface XrayDetailProps { role: UserRole; xray: XrayAttachment; }

export function XrayDetail({ role, xray }: XrayDetailProps) {
  const aiResult = useXrayAiResult(xray.id, xray.has_ai_result);
  return <div className="xray-detail-grid">
    <Card><header className="xray-detail-header"><div><p className="eyebrow">Saved X-ray</p><h3>{xrayText(xray.title || xray.original_file_name)}</h3><p>{xray.patient.full_name} · {xray.visit ? formatDateTime(xray.visit.started_at) : xraySourceLabel(xray.source)}</p></div><StatusPill status={xray.has_ai_result ? "AVAILABLE" : "NOT_RUN"} /></header>
      <ProtectedXrayImage endpoint={xray.file_endpoint} label="Protected original image" alt="Protected dental X-ray for clinical review" />
      <section aria-labelledby="xray-metadata-title"><h4 id="xray-metadata-title">Metadata</h4><dl className="detail-grid xray-metadata-grid">
        <div><dt>Patient</dt><dd><Link to={`/${role.toLowerCase()}/patients/${xray.patient.id}`}>{xray.patient.full_name}</Link></dd></div>
        <div><dt>Related visit</dt><dd>{xray.visit ? formatDateTime(xray.visit.started_at) : "—"}</dd></div>
        <div><dt>Source</dt><dd>{xraySourceLabel(xray.source)}</dd></div>
        <div><dt>Filename</dt><dd dir="ltr">{xrayText(xray.original_file_name)}</dd></div>
        <div><dt>File type</dt><dd dir="ltr">{xrayText(xray.content_type)}</dd></div>
        <div><dt>File size</dt><dd dir="ltr">{formatFileSize(xray.size_bytes)}</dd></div>
        <div><dt>Uploaded by</dt><dd>{xray.uploaded_by.full_name}</dd></div>
        <div><dt>Uploaded</dt><dd dir="ltr">{formatDateTime(xray.created_at) || "—"}</dd></div>
        <div><dt>Updated</dt><dd dir="ltr">{formatDateTime(xray.updated_at) || "—"}</dd></div>
        <div><dt>AI result</dt><dd>{aiStatusLabel(xray.has_ai_result)}</dd></div>
        <div className="detail-wide"><dt>Description</dt><dd>{xrayText(xray.notes)}</dd></div>
      </dl></section>
    </Card>
    <AiResultPanel result={aiResult.data} isLoading={aiResult.isLoading} error={aiResult.error} overlayEndpoint={xray.ai_overlay_endpoint} onRetry={() => void aiResult.refetch()} />
  </div>;
}
