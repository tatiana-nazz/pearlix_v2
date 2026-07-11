import { useState } from "react";
import { Link } from "react-router-dom";

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

export function VisitXraySection({ role, visit }: { role: UserRole; visit: VisitDetail }) {
  const user = useAuthStore((state) => state.user);
  const xrays = useXrays({ visit_id: visit.id });
  const upload = useVisitXrayUpload(visit.id);
  const [uploadOpen, setUploadOpen] = useState(false);
  const canUpload = canUploadVisitXray(role, user?.id, visit.doctor.id);
  return <Card><SectionHeader title="X-rays" description="Protected X-rays linked to this visit." />
    {canUpload ? <div className="schedule-actions"><button className="button secondary" type="button" onClick={() => { upload.reset(); setUploadOpen(true); }}>Upload visit X-ray</button></div> : null}
    {xrays.isLoading ? <LoadingState title="Loading visit X-rays..." /> : null}{xrays.isError ? <ErrorState error={xrays.error} title="Unable to load visit X-rays" onRetry={() => void xrays.refetch()} /> : null}
    {xrays.data ? (xrays.data.results.length ? <ul className="summary-list-flat">{xrays.data.results.map((xray) => <li className="summary-row" key={xray.id}><div><strong>{xray.title || xray.original_file_name}</strong><span>{xray.has_ai_result ? "AI result available" : "No AI result saved"}</span></div><Link className="button secondary compact-button" to={`/${role.toLowerCase()}/xrays/${xray.id}`}>Open X-ray</Link></li>)}</ul> : <EmptyState title="No X-rays are linked to this visit." />) : null}
    {uploadOpen ? <XrayUploadDialog title="Upload visit X-ray" isSubmitting={upload.isPending} error={upload.error} onCancel={() => setUploadOpen(false)} onSubmit={(payload) => void upload.mutateAsync(payload).then(() => setUploadOpen(false))} /> : null}
  </Card>;
}
