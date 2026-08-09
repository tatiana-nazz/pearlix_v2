import { Image, Sparkles, Trash2, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useAuthStore } from "../../../auth/authStore";
import { EmptyState } from "../../../components/EmptyState";
import { ErrorState } from "../../../components/ErrorState";
import { LoadingState } from "../../../components/LoadingState";
import { Button } from "../../../components/v2";
import type { UserRole } from "../../../types/auth";
import type { VisitDetail } from "../../../types/visits";
import type { XrayAttachment, XrayUploadPayload } from "../../../types/xrays";
import { formatDateTime } from "../../../utils/dates";
import { useProtectedMedia } from "../hooks/useProtectedMedia";
import { useDeleteSavedXray, useRunSavedXrayAi, useVisitXrayUpload, useXray, useXrayAiResult, useXrayAiResults, useXrays } from "../hooks/useXrays";
import { xrayCopy } from "../i18n";
import { aiErrorCode, aiRunErrorMessage, isAiAnalysisActive } from "../utils/aiLifecycle";
import { canDeleteSavedXray, canRunSavedXrayAi, canUploadVisitXray } from "../utils/xrayPermissions";
import { xrayText } from "../utils/xrayPresentation";
import { AiAnalysisDetails, AiResultPanel } from "./AiResultPanel";
import { DeleteSavedXrayDialog } from "./DeleteSavedXrayDialog";
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
  const aiCandidateIds = useMemo(() => xrays.data?.results.filter((xray) => xray.has_ai_result).map((xray) => xray.id) ?? [], [xrays.data?.results]);
  const aiCandidates = useXrayAiResults(aiCandidateIds, selectedXrayId ?? undefined);
  const aiCandidatesLoading = aiCandidates.some((candidate) => candidate.isLoading);
  const overlayCandidateIndex = aiCandidates.findIndex((candidate) => candidate.data?.overlay_available);
  const overlayCandidateId = aiCandidateIds[overlayCandidateIndex];
  const [overlayVisible, setOverlayVisible] = useState(false);
  const selectedXray = useXray(selectedXrayId ?? 0);
  const runAi = useRunSavedXrayAi(selectedXrayId ?? 0);
  const upload = useVisitXrayUpload(visit.id);
  const deleteXray = useDeleteSavedXray();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const canUpload = canUploadVisitXray(role, user?.id, visit.doctor.id);
  const selected = selectedXray.data ?? xrays.data?.results.find((xray) => xray.id === selectedXrayId);
  const runErrorCode = aiErrorCode(runAi.error);
  const aiResult = useXrayAiResult(
    selectedXrayId ?? 0,
    Boolean(selectedXrayId && (selected?.has_ai_result || runErrorCode === "AI_ANALYSIS_IN_PROGRESS")),
  );
  const analysisActive = isAiAnalysisActive(aiResult.data?.status) || runAi.isPending;
  const authorizedToRunAi = canRunSavedXrayAi(role, selected);
  const canStartAi = authorizedToRunAi && !analysisActive && (!aiResult.data || aiResult.data.status === "FAILED");
  const showRunAi = authorizedToRunAi && (canStartAi || analysisActive);
  const canDelete = canDeleteSavedXray(role, user?.id, selected);

  useEffect(() => {
    const records = xrays.data?.results;
    if (!records) return;
    setSelectedXrayId((current) => {
      if (!records.length) return null;
      if (current && (records.some((xray) => xray.id === current) || selectedXray.data?.id === current)) return current;
      if (aiCandidatesLoading) return current;
      return overlayCandidateId ?? records.find((xray) => xray.has_ai_result)?.id ?? records[0].id;
    });
  }, [aiCandidateIds, aiCandidatesLoading, overlayCandidateId, xrays.data, selectedXray.data?.id]);

  useEffect(() => {
    runAi.reset();
    setOverlayVisible(false);
  }, [selectedXrayId]);

  useEffect(() => {
    setOverlayVisible(false);
  }, [aiResult.data?.updated_at]);

  function finishUpload(payload: XrayUploadPayload) {
    void upload.mutateAsync(payload).then((created) => {
      setSelectedXrayId(created.id);
      setUploadOpen(false);
    });
  }

  const aiErrorMessage = aiRunErrorMessage(runAi.error, c);
  const overlayAvailable = Boolean(selected && aiResult.data?.overlay_available && selected.ai_overlay_endpoint);

  return <section className="active-xray-workspace" aria-labelledby="active-xray-title">
    <header className="active-xray-header">
      <div className="active-xray-primary-actions">
        {canUpload ? <Button type="button" onClick={() => { upload.reset(); setUploadOpen(true); }}><Upload size={18} aria-hidden="true" />{c.uploadXray}</Button> : null}
      </div>
      <div className="active-xray-selected-copy"><p className="eyebrow">{c.researchOnly}</p><h3 id="active-xray-title">{c.selectedXray}</h3><p>{selected ? xrayText(selected.title || selected.original_file_name) : c.noXrays}</p></div>
      <div className="active-xray-primary-actions">
        {showRunAi ? <Button variant="secondary" type="button" loading={runAi.isPending} disabled={analysisActive} aria-live="polite" onClick={() => runAi.mutate()}><Sparkles size={18} aria-hidden="true" />{analysisActive ? c.analyzing : aiResult.data?.status === "FAILED" ? c.retryAi : c.runAi}</Button> : null}
        {canDelete ? <Button variant="danger" type="button" disabled={analysisActive} onClick={() => { deleteXray.reset(); setDeleteOpen(true); }}><Trash2 size={18} aria-hidden="true" />{c.deleteSavedXray}</Button> : null}
        <button className="active-xray-overlay-switch" type="button" role="switch" aria-checked={overlayVisible} aria-label={`${c.aiOverlay}: ${overlayVisible ? c.overlayOn : c.overlayOff}`} disabled={!overlayAvailable} title={!overlayAvailable ? c.noOverlayAvailable : undefined} onClick={() => setOverlayVisible((visible) => !visible)}>
          <span className="active-xray-overlay-label">{c.aiOverlay}</span>
          <span className="active-xray-overlay-value">{overlayVisible ? c.overlayOn : c.overlayOff}</span>
          <span className="active-xray-overlay-track" aria-hidden="true"><span /></span>
        </button>
      </div>
    </header>

    {aiErrorMessage ? <p className="active-xray-ai-error" role="alert">{aiErrorMessage}</p> : null}
    {xrays.isLoading ? <LoadingState title={c.savedXrays} /> : null}
    {xrays.isError ? <ErrorState error={xrays.error} title={c.savedXrays} onRetry={() => void xrays.refetch()} /> : null}
    {xrays.data && !xrays.data.results.length ? <div className="active-xray-empty"><EmptyState title={c.noXrays} /></div> : null}

    {selectedXrayId ? <div className="active-xray-review-stack">
      <div className="active-xray-main-row">
        <div className="active-xray-canvas-panel">
          {selectedXray.isLoading && !selected ? <LoadingState title={c.selectedXray} /> : null}
          {selectedXray.isError ? <ErrorState error={selectedXray.error} title={c.selectedXray} onRetry={() => void selectedXray.refetch()} /> : null}
          {selected ? <ProtectedXrayViewer originalEndpoint={selected.file_endpoint} overlayEndpoint={selected.ai_overlay_endpoint} overlayAvailable={overlayAvailable} overlayVisible={overlayVisible} onOverlayVisibilityChange={setOverlayVisible} showOverlayControl={false} originalLabel={`${c.selectedXray}: ${xrayText(selected.title || selected.original_file_name)}`} originalAlt={`${xrayText(selected.title || selected.original_file_name)} — ${visit.patient.full_name}`} /> : null}
        </div>
        <aside className="active-xray-ai-result">
          <AiResultPanel result={aiResult.data} isLoading={Boolean((selected?.has_ai_result || runErrorCode === "AI_ANALYSIS_IN_PROGRESS") && aiResult.isLoading)} error={aiResult.error} onRetry={() => void aiResult.refetch()} showDisclaimer={false} />
        </aside>
      </div>
      <section className="active-xray-history-panel">
        <div className="active-xray-list-heading"><h4>{c.savedXrays}</h4><span>{xrays.data?.results.length ?? 0}</span></div>
        {xrays.data?.results.length ? <div className="active-xray-thumbnail-strip" aria-label={c.savedXrays}>{xrays.data.results.map((xray) => <XrayThumbnail key={xray.id} xray={xray} selected={xray.id === selectedXrayId} onSelect={() => setSelectedXrayId(xray.id)} />)}</div> : null}
      </section>
      <AiAnalysisDetails result={aiResult.data} />
    </div> : null}

    {uploadOpen ? <XrayUploadDialog title={c.uploadXray} isSubmitting={upload.isPending} error={upload.error} onCancel={() => setUploadOpen(false)} onSubmit={finishUpload} /> : null}
    <DeleteSavedXrayDialog xray={deleteOpen ? selected ?? null : null} error={deleteXray.error} isSubmitting={deleteXray.isPending} onCancel={() => setDeleteOpen(false)} onConfirm={() => selected && void deleteXray.mutateAsync(selected).then(() => { setDeleteOpen(false); setSelectedXrayId(null); }).catch(() => undefined)} />
  </section>;
}
