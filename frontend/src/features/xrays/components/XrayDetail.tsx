import { Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuthStore } from "../../../auth/authStore";
import { Card } from "../../../components/Card";
import { StatusPill } from "../../../components/StatusPill";
import { Button } from "../../../components/v2";
import { patientProfilePath } from "../../patients/utils/patientPermissions";
import type { UserRole } from "../../../types/auth";
import type { XrayAttachment } from "../../../types/xrays";
import { formatDateTime } from "../../../utils/dates";
import { useDeleteSavedXray, useRunSavedXrayAi, useXrayAiResult } from "../hooks/useXrays";
import { xrayCopy } from "../i18n";
import { aiErrorCode, aiRunErrorMessage, isAiAnalysisActive } from "../utils/aiLifecycle";
import { canDeleteSavedXray, canRunSavedXrayAi } from "../utils/xrayPermissions";
import { formatFileSize } from "../utils/xrayValidation";
import { aiStatusLabel, xraySourceLabel, xrayText } from "../utils/xrayPresentation";
import { AiAnalysisDetails, AiResultPanel } from "./AiResultPanel";
import { DeleteSavedXrayDialog } from "./DeleteSavedXrayDialog";
import { ProtectedXrayViewer } from "./ProtectedXrayViewer";

interface XrayDetailProps { role: UserRole; xray: XrayAttachment; }

export function XrayDetail({ role, xray }: XrayDetailProps) {
  const user = useAuthStore((state) => state.user);
  const c = xrayCopy(user?.language_preference);
  const navigate = useNavigate();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const deleteXray = useDeleteSavedXray();
  const runAi = useRunSavedXrayAi(xray.id);
  const runErrorCode = aiErrorCode(runAi.error);
  const aiResult = useXrayAiResult(
    xray.id,
    xray.has_ai_result || runErrorCode === "AI_ANALYSIS_IN_PROGRESS",
  );
  const analysisActive = isAiAnalysisActive(aiResult.data?.status) || runAi.isPending;
  const authorizedToRunAi = canRunSavedXrayAi(role, xray);
  const canStartAi = authorizedToRunAi && !analysisActive && (!aiResult.data || aiResult.data.status === "FAILED");
  const showRunAi = authorizedToRunAi && (canStartAi || analysisActive);
  const canDelete = canDeleteSavedXray(role, user?.id, xray);
  const aiErrorMessage = aiRunErrorMessage(runAi.error, c);
  return <div className="xray-detail-grid">
    <Card><header className="xray-detail-header"><div><p className="eyebrow">Saved X-ray</p><h3>{xrayText(xray.title || xray.original_file_name)}</h3><p>{xray.patient.full_name} · {xray.visit ? formatDateTime(xray.visit.started_at) : xraySourceLabel(xray.source)}</p></div><StatusPill status={xray.has_ai_result ? "AVAILABLE" : "NOT_RUN"} /></header>
      <ProtectedXrayViewer originalEndpoint={xray.file_endpoint} overlayEndpoint={xray.ai_overlay_endpoint} overlayAvailable={Boolean(aiResult.data?.overlay_available)} originalLabel="Protected original image" originalAlt="Protected dental X-ray for clinical review" />
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
      {aiErrorMessage ? <p className="active-xray-ai-error" role="alert">{aiErrorMessage}</p> : null}
      {showRunAi || canDelete ? <div className="xray-detail-actions">{showRunAi ? <Button type="button" loading={runAi.isPending} disabled={analysisActive} onClick={() => runAi.mutate()}><Sparkles size={18} aria-hidden="true" />{analysisActive ? c.analyzing : aiResult.data?.status === "FAILED" ? c.retryAi : c.runAi}</Button> : null}{canDelete ? <Button variant="danger" type="button" disabled={analysisActive} onClick={() => { deleteXray.reset(); setDeleteOpen(true); }}><Trash2 size={18} aria-hidden="true" />{c.deleteSavedXray}</Button> : null}</div> : null}
    </Card>
    <div className="xray-ai-detail-column"><AiResultPanel result={aiResult.data} isLoading={aiResult.isLoading} error={aiResult.error} onRetry={() => void aiResult.refetch()} showDisclaimer={false} /><AiAnalysisDetails result={aiResult.data} /></div>
    <DeleteSavedXrayDialog xray={deleteOpen ? xray : null} error={deleteXray.error} isSubmitting={deleteXray.isPending} onCancel={() => setDeleteOpen(false)} onConfirm={() => void deleteXray.mutateAsync(xray).then(() => navigate(`${patientProfilePath(role, xray.patient.id)}?tab=xrays`, { replace: true })).catch(() => undefined)} />
  </div>;
}
