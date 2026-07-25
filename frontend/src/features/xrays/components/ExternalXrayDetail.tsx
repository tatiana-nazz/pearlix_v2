import { useState } from "react";
import { Link } from "react-router-dom";

import { Card } from "../../../components/Card";
import { StatusPill } from "../../../components/StatusPill";
import { Button } from "../../../components/v2";
import { useAuthStore } from "../../../auth/authStore";
import type { UserRole } from "../../../types/auth";
import type { ExternalXrayCase } from "../../../types/xrays";
import { formatDateTime } from "../../../utils/dates";
import { useExternalAiResult, useExternalXrayMutations } from "../hooks/useXrays";
import { formatFileSize } from "../utils/xrayValidation";
import { xrayText } from "../utils/xrayPresentation";
import { AiResultPanel } from "./AiResultPanel";
import { AttachExternalXrayDialog, DiscardExternalXrayDialog } from "./ExternalXrayDialogs";
import { ProtectedXrayImage } from "./ProtectedXrayImage";
import { canAttachExternalXray, canManageExternalXray } from "../utils/xrayPermissions";

interface ExternalXrayDetailProps { role: UserRole; external: ExternalXrayCase; }
export function ExternalXrayDetail({ role, external }: ExternalXrayDetailProps) {
  const user = useAuthStore((state) => state.user);
  const ai = useExternalAiResult(external.id, external.has_ai_result);
  const mutations = useExternalXrayMutations();
  const [attachOpen, setAttachOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const canManage = canManageExternalXray(role, user?.id, external);
  const canAttach = canAttachExternalXray(role, user?.id, external);
  return <div className="xray-detail-grid"><Card><header className="xray-detail-header"><div><p className="eyebrow">External X-ray</p><h3>{xrayText(external.title || external.original_file_name)}</h3><p>External temporary record — not a patient record.</p></div><StatusPill status={external.status} /></header>
    <ProtectedXrayImage endpoint={external.file_endpoint} label="Protected original image" alt="Protected temporary external dental X-ray" />
    <section aria-labelledby="external-metadata-title"><h4 id="external-metadata-title">Metadata</h4><dl className="detail-grid xray-metadata-grid"><div><dt>Uploaded by</dt><dd>{external.uploaded_by.full_name}</dd></div><div><dt>Uploaded</dt><dd dir="ltr">{formatDateTime(external.created_at) || "—"}</dd></div><div><dt>Filename</dt><dd dir="ltr">{xrayText(external.original_file_name)}</dd></div><div><dt>File</dt><dd dir="ltr">{external.content_type} · {formatFileSize(external.size_bytes)}</dd></div><div><dt>Attached patient</dt><dd>{external.attached_patient ? <Link to={`/${role.toLowerCase()}/patients/${external.attached_patient.id}`}>{external.attached_patient.full_name}</Link> : "—"}</dd></div><div className="detail-wide"><dt>Description</dt><dd>{xrayText(external.notes)}</dd></div></dl></section>
    {canManage ? <div className="xray-detail-actions">{canAttach ? <Button variant="secondary" type="button" onClick={() => { mutations.attach.reset(); setAttachOpen(true); }}>Attach to patient</Button> : null}<Button variant="danger" type="button" onClick={() => { mutations.discard.reset(); setDiscardOpen(true); }}>Discard case</Button></div> : null}
  </Card><AiResultPanel result={ai.data} isLoading={ai.isLoading} error={ai.error} overlayEndpoint={external.ai_overlay_endpoint} onRetry={() => void ai.refetch()} />
  {attachOpen ? <AttachExternalXrayDialog external={external} error={mutations.attach.error} isSubmitting={mutations.attach.isPending} onCancel={() => setAttachOpen(false)} onSubmit={(payload) => void mutations.attach.mutateAsync({ caseId: external.id, payload }).then(() => setAttachOpen(false))} /> : null}
  {discardOpen ? <DiscardExternalXrayDialog external={external} error={mutations.discard.error} isSubmitting={mutations.discard.isPending} onCancel={() => setDiscardOpen(false)} onConfirm={() => void mutations.discard.mutateAsync(external.id).then(() => setDiscardOpen(false))} /> : null}
  </div>;
}
