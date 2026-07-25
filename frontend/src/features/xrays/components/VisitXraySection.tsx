import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { Card } from "../../../components/Card";
import { EmptyState } from "../../../components/EmptyState";
import { ErrorState } from "../../../components/ErrorState";
import { LoadingState } from "../../../components/LoadingState";
import { SectionHeader } from "../../../components/SectionHeader";
import { useAuthStore } from "../../../auth/authStore";
import type { UserRole } from "../../../types/auth";
import type { VisitDetail } from "../../../types/visits";
import { useVisitXrayUpload, useXrays } from "../hooks/useXrays";
import { canUploadVisitXray } from "../utils/xrayPermissions";
import { XrayUploadDialog } from "./XrayUploadDialog";
import { visitCopy } from "../../visits/i18n";
import { xrayCopy } from "../i18n";

export function VisitXraySection({ role, visit }: { role: UserRole; visit: VisitDetail }) {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const c = visitCopy(user?.language_preference);
  const xrayC = xrayCopy(user?.language_preference);
  const xrays = useXrays({ visit_id: visit.id });
  const upload = useVisitXrayUpload(visit.id);
  const [uploadOpen, setUploadOpen] = useState(false);
  const canUpload = canUploadVisitXray(role, user?.id, visit.doctor.id);
  return <Card><SectionHeader title={c.xraysTitle} description={c.xraysDescription} />
    {canUpload ? <div className="schedule-actions"><button className="button secondary" type="button" onClick={() => { upload.reset(); setUploadOpen(true); }}>{xrayC.uploadXray}</button></div> : null}
    {xrays.isLoading ? <LoadingState title={c.loadingXrays} /> : null}{xrays.isError ? <ErrorState error={xrays.error} title={c.loadXraysError} onRetry={() => void xrays.refetch()} /> : null}
    {xrays.data ? (xrays.data.results.length ? <ul className="summary-list-flat">{xrays.data.results.map((xray) => { const open = () => navigate(`/${role.toLowerCase()}/xrays/${xray.id}`); return <li className="summary-row clickable-row" key={xray.id} tabIndex={0} onClick={open} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); } }}><div><strong>{xray.title || xray.original_file_name}</strong><span>{xray.has_ai_result ? c.aiResultAvailable : c.noAiResult}</span></div></li>; })}</ul> : <EmptyState title={c.noXrays} />) : null}
    {uploadOpen ? <XrayUploadDialog title={xrayC.uploadXray} isSubmitting={upload.isPending} error={upload.error} onCancel={() => setUploadOpen(false)} onSubmit={(payload) => void upload.mutateAsync(payload).then(() => setUploadOpen(false))} /> : null}
  </Card>;
}
