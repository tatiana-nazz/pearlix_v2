import { Image, Sparkles, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { normalizeApiError } from "../../../api/errors";
import { useAuthStore } from "../../../auth/authStore";
import { EmptyState } from "../../../components/EmptyState";
import { ErrorState } from "../../../components/ErrorState";
import { LoadingState } from "../../../components/LoadingState";
import { Button } from "../../../components/v2";
import { useFeatureT } from "../../../layouts/i18n";
import type { UserRole } from "../../../types/auth";
import type { VisitDetail } from "../../../types/visits";
import type { XrayAttachment, XrayUploadPayload } from "../../../types/xrays";
import { formatDateTime } from "../../../utils/dates";
import { useProtectedMedia } from "../hooks/useProtectedMedia";
import { useRunSavedXrayAi, useVisitXrayUpload, useXray, useXrayAiResult, useXrayAiResults, useXrays } from "../hooks/useXrays";
import { canRunSavedXrayAi, canUploadVisitXray } from "../utils/xrayPermissions";
import { AiAnalysisDetails, AiResultPanel } from "./AiResultPanel";
import { OverlaySwitch, ProtectedXrayViewer } from "./ProtectedXrayViewer";
import { XrayUploadDialog } from "./XrayUploadDialog";

function XrayThumbnail({ xray, selected, onSelect }: { xray: XrayAttachment; selected: boolean; onSelect: () => void }) {
  const t = useFeatureT();
  const media = useProtectedMedia(xray.file_endpoint);
  const label = xray.title || xray.original_file_name;
  return <button className="active-xray-thumbnail" type="button" aria-pressed={selected} aria-label={label} onClick={onSelect}><span className="active-xray-thumbnail-image">{media.url ? <img src={media.url} alt="" aria-hidden="true" /> : <Image size={24} aria-hidden="true" />}</span><span><strong>{label}</strong><small>{formatDateTime(xray.created_at)}</small><small>{xray.content_type.replace("image/", "").toUpperCase()} · {xray.source.replace(/_/g, " ")}</small><span className="active-xray-ai-status">{xray.has_ai_result ? t("aiResult") : t("noStoredAiResult")}</span></span></button>;
}

export function ActiveVisitXrayWorkspace({ role, visit }: { role: UserRole; visit: VisitDetail }) {
  const t = useFeatureT();
  const user = useAuthStore((state) => state.user);
  const xrays = useXrays({ visit_id: visit.id });
  const aiCandidateIds = useMemo(() => xrays.data?.results.filter((xray) => xray.has_ai_result).map((xray) => xray.id) ?? [], [xrays.data?.results]);
  const aiCandidates = useXrayAiResults(aiCandidateIds);
  const aiCandidatesLoading = aiCandidates.some((candidate) => candidate.isLoading);
  const overlayCandidateIndex = aiCandidates.findIndex((candidate) => candidate.data?.overlay_available);
  const overlayCandidateId = aiCandidateIds[overlayCandidateIndex];
  const [selectedXrayId, setSelectedXrayId] = useState<number | null>(null);
  const [overlayVisible, setOverlayVisible] = useState(false);
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
      if (current && (records.some((xray) => xray.id === current) || selectedXray.data?.id === current)) return current;
      if (aiCandidatesLoading) return current;
      return overlayCandidateId ?? records.find((xray) => xray.has_ai_result)?.id ?? records[0].id;
    });
  }, [aiCandidatesLoading, overlayCandidateId, selectedXray.data?.id, xrays.data]);

  useEffect(() => { runAi.reset(); setOverlayVisible(false); }, [selectedXrayId]);

  function finishUpload(payload: XrayUploadPayload) {
    void upload.mutateAsync(payload).then((created) => { setSelectedXrayId(created.id); setUploadOpen(false); });
  }

  const aiError = runAi.error ? normalizeApiError(runAi.error) : null;
  const aiErrorMessage = aiError?.code === "AI_SERVICE_NOT_CONFIGURED" ? t("aiServiceUnavailable") : t("aiRequestFailed");
  const overlayAvailable = Boolean(selected && aiResult.data?.overlay_available && selected.ai_overlay_endpoint);

  return <section className="active-xray-workspace" aria-labelledby="active-xray-title">
    <header className="active-xray-header"><div className="active-xray-primary-actions">{canUpload ? <Button type="button" onClick={() => { upload.reset(); setUploadOpen(true); }}><Upload size={18} aria-hidden="true" />{t("uploadXray")}</Button> : null}</div><div className="active-xray-selected-copy"><p className="eyebrow">{t("researchOnly")}</p><h3 id="active-xray-title">{t("selectedXray")}</h3><p>{selected ? selected.title || selected.original_file_name : t("noSavedXrays")}</p></div><div className="active-xray-primary-actions">{canRunAi ? <Button variant="secondary" type="button" loading={runAi.isPending} onClick={() => runAi.mutate()}><Sparkles size={18} aria-hidden="true" />{runAi.isPending ? t("runningAiAnalysis") : t("runAiAnalysis")}</Button> : null}<OverlaySwitch visible={overlayVisible} available={overlayAvailable} onToggle={() => setOverlayVisible((visible) => !visible)} /></div></header>
    {aiError ? <p className="active-xray-ai-error" role="alert">{aiErrorMessage}</p> : null}
    {xrays.isLoading ? <LoadingState title={t("savedXrays")} /> : null}
    {xrays.isError ? <ErrorState error={xrays.error} title={t("savedXrays")} onRetry={() => void xrays.refetch()} /> : null}
    {xrays.data && !xrays.data.results.length ? <div className="active-xray-empty"><EmptyState title={t("noSavedXrays")} /></div> : null}
    {selectedXrayId ? <div className="active-xray-review-stack"><div className="active-xray-main-row"><div className="active-xray-canvas-panel">{selectedXray.isLoading && !selected ? <LoadingState title={t("selectedXray")} /> : null}{selectedXray.isError ? <ErrorState error={selectedXray.error} title={t("selectedXray")} onRetry={() => void selectedXray.refetch()} /> : null}{selected ? <ProtectedXrayViewer originalEndpoint={selected.file_endpoint} overlayEndpoint={selected.ai_overlay_endpoint} overlayAvailable={overlayAvailable} overlayVisible={overlayVisible} onOverlayVisibilityChange={setOverlayVisible} originalLabel={`${t("selectedXray")}: ${selected.title || selected.original_file_name}`} originalAlt={`${selected.title || selected.original_file_name} — ${visit.patient.full_name}`} /> : null}</div><aside className="active-xray-ai-result"><AiResultPanel result={aiResult.data} isLoading={Boolean(selected?.has_ai_result && aiResult.isLoading)} error={aiResult.error} onRetry={() => void aiResult.refetch()} /></aside></div><section className="active-xray-history-panel"><div className="active-xray-list-heading"><h4>{t("savedXrays")}</h4><span>{xrays.data?.results.length ?? 0}</span></div>{xrays.data?.results.length ? <div className="active-xray-thumbnail-strip" aria-label={t("savedXrays")}>{xrays.data.results.map((xray) => <XrayThumbnail key={xray.id} xray={xray} selected={xray.id === selectedXrayId} onSelect={() => setSelectedXrayId(xray.id)} />)}</div> : null}</section><AiAnalysisDetails result={aiResult.data} /></div> : null}
    {uploadOpen ? <XrayUploadDialog title={t("uploadXray")} isSubmitting={upload.isPending} error={upload.error} onCancel={() => setUploadOpen(false)} onSubmit={finishUpload} /> : null}
  </section>;
}
