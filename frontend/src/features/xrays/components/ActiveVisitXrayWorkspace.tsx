import { Image, Sparkles, Upload } from "lucide-react";
import { useEffect, useState } from "react";

import { useAuthStore } from "../../../auth/authStore";
import { EmptyState } from "../../../components/EmptyState";
import { ErrorState } from "../../../components/ErrorState";
import { LoadingState } from "../../../components/LoadingState";
import { Button } from "../../../components/v2";
import { normalizeApiError } from "../../../api/errors";
import type { UserRole } from "../../../types/auth";
import type { VisitDetail } from "../../../types/visits";
import type { XrayAttachment, XrayUploadPayload } from "../../../types/xrays";
import { formatDateTime } from "../../../utils/dates";
import { useProtectedMedia } from "../hooks/useProtectedMedia";
import { useRunSavedXrayAi, useVisitXrayUpload, useXray, useXrayAiResult, useXrays } from "../hooks/useXrays";
import { xrayCopy } from "../i18n";
import { canRunSavedXrayAi, canUploadVisitXray } from "../utils/xrayPermissions";
import { xrayText } from "../utils/xrayPresentation";
import { AiResultPanel } from "./AiResultPanel";
import { ProtectedXrayViewer } from "./ProtectedXrayViewer";
import { XrayUploadDialog } from "./XrayUploadDialog";

function XrayThumbnail({ xray, selected, onSelect }: { xray: XrayAttachment; selected: boolean; onSelect: () => void }) {
  const c = xrayCopy(useAuthStore((state) => state.user?.language_preference));
  const media = useProtectedMedia(xray.file_endpoint);
  const label = xrayText(xray.title || xray.original_file_name);
  return <button className="active-xray-thumbnail" type="button" aria-pressed={selected} aria-label={label} onClick={onSelect}>
    <span className="active-xray-thumbnail-image">{media.url ? <img src={media.url} alt="" aria-hidden="true" /> : <Image size={24} aria-hidden="true" />}</span>
    <span><strong>{label}</strong><small>{formatDateTime(xray.created_at)}</small><small>{xray.content_type.replace("image/", "").toUpperCase()} · {xray.source.replace(/_/g, " ")}</small><span className="active-xray-ai-status">{xray.has_ai_result ? c.aiResult : c.noResult}</span></span>
  </button>;
}

export function ActiveVisitXrayWorkspace({ role, visit }: { role: UserRole; visit: VisitDetail }) {
  const user = useAuthStore((state) => state.user);
  const c = xrayCopy(user?.language_preference);
  const xrays = useXrays({ visit_id: visit.id });
  const [selectedXrayId, setSelectedXrayId] = useState<number | null>(null);
  const selectedXray = useXray(selectedXrayId ?? 0);
  const aiResult = useXrayAiResult(selectedXrayId ?? 0, Boolean(selectedXrayId && selectedXray.data?.has_ai_result));
  const runAi = useRunSavedXrayAi(selectedXrayId ?? 0);
  const upload = useVisitXrayUpload(visit.id);
  const [uploadOpen, setUploadOpen] = useState(false);
  const canUpload = canUploadVisitXray(role, user?.id, visit.doctor.id);
  const selected = selectedXray.data ?? xrays.data?.results.find((xray) => xray.id === selectedXrayId);
  const canRunAi = canRunSavedXrayAi(role, selected) && !selected?.has_ai_result && !aiResult.data;

  useEffect(() => {
    const records = xrays.data?.results;
    if (!records) return;
    setSelectedXrayId((current) => {
      if (!records.length) return null;
      return current && (records.some((xray) => xray.id === current) || selectedXray.data?.id === current) ? current : records[0].id;
    });
  }, [xrays.data, selectedXray.data?.id]);

  useEffect(() => {
    runAi.reset();
  }, [selectedXrayId]);

  function finishUpload(payload: XrayUploadPayload) {
    void upload.mutateAsync(payload).then((created) => {
      setSelectedXrayId(created.id);
      setUploadOpen(false);
    });
  }

  const aiError = runAi.error ? normalizeApiError(runAi.error) : null;
  const aiErrorMessage = aiError?.code === "AI_SERVICE_NOT_CONFIGURED" ? c.aiServiceUnavailable : c.aiRequestFailed;

  return <section className="active-xray-workspace" aria-labelledby="active-xray-title">
    <header className="active-xray-header">
      <div className="active-xray-primary-actions">
        {canUpload ? <Button type="button" onClick={() => { upload.reset(); setUploadOpen(true); }}><Upload size={18} aria-hidden="true" />{c.uploadXray}</Button> : null}
      </div>
      <div className="active-xray-selected-copy"><p className="eyebrow">{c.researchOnly}</p><h3 id="active-xray-title">{c.selectedXray}</h3><p>{selected ? xrayText(selected.title || selected.original_file_name) : c.noXrays}</p></div>
      <div className="active-xray-primary-actions">
        {canRunAi ? <Button variant="secondary" type="button" loading={runAi.isPending} aria-live="polite" onClick={() => runAi.mutate()}><Sparkles size={18} aria-hidden="true" />{runAi.isPending ? c.runningAi : c.runAi}</Button> : null}
      </div>
    </header>

    {aiError ? <p className="active-xray-ai-error" role="alert">{aiErrorMessage}</p> : null}
    {xrays.isLoading ? <LoadingState title={c.savedXrays} /> : null}
    {xrays.isError ? <ErrorState error={xrays.error} title={c.savedXrays} onRetry={() => void xrays.refetch()} /> : null}
    {xrays.data && !xrays.data.results.length ? <div className="active-xray-empty"><EmptyState title={c.noXrays} /></div> : null}

    {selectedXrayId ? <div className="active-xray-review-grid">
      <aside className="active-xray-list-panel">
        <div className="active-xray-list-heading"><h4>{c.savedXrays}</h4><span>{xrays.data?.results.length ?? 0}</span></div>
        {xrays.data?.results.length ? <div className="active-xray-thumbnail-strip" aria-label={c.savedXrays}>{xrays.data.results.map((xray) => <XrayThumbnail key={xray.id} xray={xray} selected={xray.id === selectedXrayId} onSelect={() => setSelectedXrayId(xray.id)} />)}</div> : null}
      </aside>
      <div className="active-xray-review-main">
        <div className="active-xray-canvas-panel">
          {selectedXray.isLoading && !selected ? <LoadingState title={c.selectedXray} /> : null}
          {selectedXray.isError ? <ErrorState error={selectedXray.error} title={c.selectedXray} onRetry={() => void selectedXray.refetch()} /> : null}
          {selected ? <ProtectedXrayViewer originalEndpoint={selected.file_endpoint} overlayEndpoint={selected.ai_overlay_endpoint} overlayAvailable={Boolean(aiResult.data?.overlay_available)} originalLabel={`${c.selectedXray}: ${xrayText(selected.title || selected.original_file_name)}`} originalAlt={`${xrayText(selected.title || selected.original_file_name)} — ${visit.patient.full_name}`} /> : null}
        </div>
        <aside className="active-xray-ai-column">
          <AiResultPanel result={aiResult.data} isLoading={Boolean(selected?.has_ai_result && aiResult.isLoading)} error={aiResult.error} onRetry={() => void aiResult.refetch()} />
        </aside>
      </div>
    </div> : null}

    {uploadOpen ? <XrayUploadDialog title={c.uploadXray} isSubmitting={upload.isPending} error={upload.error} onCancel={() => setUploadOpen(false)} onSubmit={finishUpload} /> : null}
  </section>;
}
