import { useState } from "react";
import { Link } from "react-router-dom";

import { Card } from "../../../components/Card";
import { ErrorState } from "../../../components/ErrorState";
import { StatusPill } from "../../../components/StatusPill";
import { useAuthStore } from "../../../auth/authStore";
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
  const user = useAuthStore((state) => state.user);
  const ai = useExternalAiResult(external.id, external.has_ai_result);
  const mutations = useExternalXrayMutations();
  const [attachOpen, setAttachOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const canManage = canManageExternalXray(role, user?.id, external);
  return <div className="xray-detail-grid"><Card><div className="visit-summary-header"><div><p className="eyebrow">External X-ray</p><h3>{displayText(external.title, external.original_file_name)}</h3></div><StatusPill status={external.status} /></div>
    <ProtectedXrayImage endpoint={external.file_endpoint} label="Original X-ray" alt="Protected temporary external dental X-ray" />
    <dl className="detail-grid"><div><dt>Uploaded by</dt><dd>{external.uploaded_by.full_name}</dd></div><div><dt>Uploaded</dt><dd>{formatDateTime(external.created_at)}</dd></div><div><dt>File</dt><dd>{external.content_type} · {formatFileSize(external.size_bytes)}</dd></div><div><dt>Attached patient</dt><dd>{external.attached_patient ? <Link to={`/${role.toLowerCase()}/patients/${external.attached_patient.id}`}>{external.attached_patient.full_name}</Link> : "Not attached"}</dd></div><div className="detail-wide"><dt>Notes</dt><dd>{displayText(external.notes)}</dd></div></dl>
    {canManage ? <div className="xray-run-ai"><button className="button primary" type="button" disabled={mutations.runAi.isPending} onClick={() => void mutations.runAi.mutateAsync(external.id)}>{mutations.runAi.isPending ? "Running AI..." : "Run AI"}</button>{canAttachExternalXray(role, user?.id, external) ? <button className="button secondary" type="button" onClick={() => { mutations.attach.reset(); setAttachOpen(true); }}>Attach to patient</button> : null}<button className="button secondary" type="button" onClick={() => { mutations.discard.reset(); setDiscardOpen(true); }}>Discard case</button></div> : null}
    {mutations.runAi.error ? <ErrorState error={mutations.runAi.error} title="AI run unavailable" /> : null}
  </Card><AiResultPanel result={mutations.runAi.data ?? ai.data} isLoading={ai.isLoading} error={ai.error} overlayEndpoint={external.ai_overlay_endpoint} onRetry={() => void ai.refetch()} />
  {attachOpen ? <AttachExternalXrayDialog external={external} error={mutations.attach.error} isSubmitting={mutations.attach.isPending} onCancel={() => setAttachOpen(false)} onSubmit={(payload) => void mutations.attach.mutateAsync({ caseId: external.id, payload }).then(() => setAttachOpen(false))} /> : null}
  {discardOpen ? <DiscardExternalXrayDialog external={external} error={mutations.discard.error} isSubmitting={mutations.discard.isPending} onCancel={() => setDiscardOpen(false)} onConfirm={() => void mutations.discard.mutateAsync(external.id).then(() => setDiscardOpen(false))} /> : null}
  </div>;
}
