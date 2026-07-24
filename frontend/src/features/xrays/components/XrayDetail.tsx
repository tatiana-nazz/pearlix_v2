import { Link } from "react-router-dom";

import { Button, StatePanel, StatusBadge, SurfaceCard } from "../../../components/v2";
import { useFeatureT } from "../../../layouts/i18n";
import type { UserRole } from "../../../types/auth";
import type { XrayAttachment } from "../../../types/xrays";
import { formatDateTime } from "../../../utils/dates";
import { displayText } from "../../../utils/formatters";
import { useRunSavedXrayAi, useXrayAiResult } from "../hooks/useXrays";
import { canRunSavedXrayAi } from "../utils/xrayPermissions";
import { formatFileSize } from "../utils/xrayValidation";
import { AiResultPanel } from "./AiResultPanel";
import { ProtectedXrayImage } from "./ProtectedXrayImage";

export function XrayDetail({ role, xray }: { role: UserRole; xray: XrayAttachment }) {
  const t = useFeatureT();
  const aiResult = useXrayAiResult(xray.id, xray.has_ai_result);
  const runAi = useRunSavedXrayAi(xray.id);
  const canRun = canRunSavedXrayAi(role, xray);
  const source = xray.source === "ACTIVE_VISIT" ? t("activeVisit") : xray.source === "PATIENT_PROFILE" ? t("patientProfileSource") : t("externalWorkspace");
  const aiLabel = xray.has_ai_result ? t("aiAvailable") : t("aiNotRun");
  return <div className="xray-detail-grid">
    <SurfaceCard major className="xray-clinical-frame">
      <header className="xray-detail-hero"><div><p className="eyebrow">{t("protectedXray")}</p><h3 className="bidi-isolate">{displayText(xray.title, xray.original_file_name)}</h3><p>{source}</p></div><div className="xray-detail-status"><StatusBadge status={xray.has_ai_result ? "COMPLETED" : "PENDING"} /><span>{aiLabel}</span></div></header>
      <ProtectedXrayImage endpoint={xray.file_endpoint} label={t("originalXray")} alt={t("protectedXray")} />
      <dl className="xray-fact-grid"><div><dt>{t("patient")}</dt><dd><Link className="bidi-isolate" to={`/${role.toLowerCase()}/patients/${xray.patient.id}`}>{xray.patient.full_name}</Link></dd></div><div><dt>{t("visitContext")}</dt><dd>{xray.visit ? <span className="bidi-isolate">{formatDateTime(xray.visit.started_at)} · <StatusBadge status={xray.visit.status} /></span> : t("patientProfileSource")}</dd></div><div><dt>{t("file")}</dt><dd className="bidi-isolate">{xray.content_type} · {formatFileSize(xray.size_bytes)}</dd></div><div><dt>{t("uploaded")}</dt><dd className="bidi-isolate">{formatDateTime(xray.created_at)}</dd></div><div><dt>{t("uploadedBy")}</dt><dd>{xray.uploaded_by.full_name}</dd></div><div className="xray-fact-wide"><dt>{t("notes")}</dt><dd>{displayText(xray.notes, t("notRecorded"))}</dd></div></dl>
      <div className="xray-action-band">{canRun ? <Button type="button" loading={runAi.isPending} onClick={() => void runAi.mutateAsync()}>{runAi.isPending ? t("runningAi") : t("runAi")}</Button> : <span className="xray-readonly-status">{t("aiResult")}: {aiLabel}</span>}{runAi.error ? <StatePanel state="error" title={t("aiUnavailable")} /> : null}</div>
    </SurfaceCard>
    <aside className="xray-ai-rail"><AiResultPanel result={runAi.data ?? aiResult.data} isLoading={aiResult.isLoading} error={aiResult.error} overlayEndpoint={xray.ai_overlay_endpoint} onRetry={() => void aiResult.refetch()} /></aside>
  </div>;
}
