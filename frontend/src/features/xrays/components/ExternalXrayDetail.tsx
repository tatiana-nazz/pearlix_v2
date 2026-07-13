import { useState } from "react";
import { Link } from "react-router-dom";

import { Button, StatePanel, StatusBadge, SurfaceCard } from "../../../components/v2";
import { useAuthStore } from "../../../auth/authStore";
import { useFeatureT } from "../../../layouts/i18n";
import type { UserRole } from "../../../types/auth";
import type { ExternalXrayCase } from "../../../types/xrays";
import { formatDateTime } from "../../../utils/dates";
import { displayText } from "../../../utils/formatters";
import { useExternalAiResult, useExternalXrayMutations } from "../hooks/useXrays";
import { canAttachExternalXray, canManageExternalXray } from "../utils/xrayPermissions";
import { formatFileSize } from "../utils/xrayValidation";
import { AiResultPanel } from "./AiResultPanel";
import { AttachExternalXrayDialog, DiscardExternalXrayDialog } from "./ExternalXrayDialogs";
import { ProtectedXrayImage } from "./ProtectedXrayImage";

interface ExternalXrayDetailProps { role: UserRole; external: ExternalXrayCase; }
export function ExternalXrayDetail({ role, external }: ExternalXrayDetailProps) {
  const t = useFeatureT();
  const user = useAuthStore((state) => state.user);
  const ai = useExternalAiResult(external.id, external.has_ai_result);
  const mutations = useExternalXrayMutations();
  const [attachOpen, setAttachOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const canManage = canManageExternalXray(role, user?.id, external);
  const canAttach = canAttachExternalXray(role, user?.id, external);
  const externalStatus = external.status === "TEMPORARY" ? t("temporary") : external.status === "ATTACHED_TO_PATIENT" ? t("attachedToPatient") : t("discarded");
  const patientRoute = external.attached_patient ? `/${role.toLowerCase()}/patients/${external.attached_patient.id}` : null;
  return <div className="xray-detail-grid"><SurfaceCard major><div className="visit-summary-header"><div><p className="eyebrow">{t("externalWorkspace")}</p><h3 className="bidi-isolate">{displayText(external.title, external.original_file_name)}</h3></div><span aria-label={t("status")}>{externalStatus}</span></div>
    <ProtectedXrayImage endpoint={external.file_endpoint} label={t("originalXray")} alt={t("protectedXray")} />
    <dl className="detail-grid"><div><dt>{t("uploadedBy")}</dt><dd className="bidi-isolate">{external.uploaded_by.full_name}</dd></div><div><dt>{t("uploaded")}</dt><dd className="bidi-isolate">{formatDateTime(external.created_at)}</dd></div><div><dt>{t("file")}</dt><dd className="bidi-isolate">{external.content_type} · {formatFileSize(external.size_bytes)}</dd></div><div><dt>{t("status")}</dt><dd><StatusBadge status={external.status === "TEMPORARY" ? "PENDING" : external.status === "DISCARDED" ? "DISMISSED" : "COMPLETED"} /> <span>{externalStatus}</span></dd></div><div><dt>{t("attachedPatient")}</dt><dd>{patientRoute ? <Link className="bidi-isolate" to={patientRoute}>{external.attached_patient?.full_name}</Link> : t("notAttached")}</dd></div><div><dt>{t("attachedVisit")}</dt><dd>{external.attached_visit ? <span className="bidi-isolate">{formatDateTime(external.attached_visit.started_at)} · {external.attached_visit.status === "ACTIVE" ? t("activeVisit") : t("completed")}</span> : t("notAttached")}</dd></div>{external.attached_at ? <div><dt>{t("attachedAt")}</dt><dd className="bidi-isolate">{formatDateTime(external.attached_at)}</dd></div> : null}{external.discarded_at ? <div><dt>{t("discardedAt")}</dt><dd className="bidi-isolate">{formatDateTime(external.discarded_at)}</dd></div> : null}<div className="detail-wide"><dt>{t("notes")}</dt><dd>{displayText(external.notes, t("notRecorded"))}</dd></div></dl>
    {canManage ? <div className="xray-run-ai"><Button type="button" loading={mutations.runAi.isPending} onClick={() => void mutations.runAi.mutateAsync(external.id)}>{mutations.runAi.isPending ? t("runningAi") : t("runAi")}</Button>{canAttach ? <Button variant="secondary" type="button" onClick={() => { mutations.attach.reset(); setAttachOpen(true); }}>{t("attachToPatient")}</Button> : null}<Button variant="danger" type="button" onClick={() => { mutations.discard.reset(); setDiscardOpen(true); }}>{t("discardCase")}</Button></div> : null}
    {mutations.runAi.error ? <StatePanel state="error" title={t("aiUnavailable")} action={<Button variant="secondary" type="button" onClick={() => mutations.runAi.reset()}>{t("retry")}</Button>} /> : null}
  </SurfaceCard><AiResultPanel result={mutations.runAi.data ?? ai.data} isLoading={ai.isLoading} error={ai.error} overlayEndpoint={external.ai_overlay_endpoint} onRetry={() => void ai.refetch()} />
  {attachOpen ? <AttachExternalXrayDialog external={external} error={mutations.attach.error} isSubmitting={mutations.attach.isPending} onCancel={() => setAttachOpen(false)} onSubmit={(payload) => { void mutations.attach.mutateAsync({ caseId: external.id, payload }).then(() => setAttachOpen(false)); }} /> : null}
  {discardOpen ? <DiscardExternalXrayDialog external={external} error={mutations.discard.error} isSubmitting={mutations.discard.isPending} onCancel={() => setDiscardOpen(false)} onConfirm={() => { void mutations.discard.mutateAsync(external.id).then(() => setDiscardOpen(false)); }} /> : null}
  </div>;
}
