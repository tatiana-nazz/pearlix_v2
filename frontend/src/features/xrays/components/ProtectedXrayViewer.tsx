import { Maximize2, Minimize2, Minus, Plus, RotateCcw, Scan } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button, StatePanel } from "../../../components/v2";
import { useFeatureT } from "../../../layouts/i18n";
import { useProtectedMedia } from "../hooks/useProtectedMedia";

interface ProtectedXrayViewerProps {
  originalEndpoint: string;
  overlayEndpoint?: string;
  overlayAvailable?: boolean;
  originalAlt: string;
  originalLabel: string;
  overlayVisible?: boolean;
  onOverlayVisibilityChange?: (visible: boolean) => void;
}

const MIN_SCALE = 0.5;
const MAX_SCALE = 3;
const SCALE_STEP = 0.25;

export function ProtectedXrayViewer({ originalEndpoint, overlayEndpoint, overlayAvailable = false, originalAlt, originalLabel, overlayVisible: controlledOverlayVisible, onOverlayVisibilityChange }: ProtectedXrayViewerProps) {
  const t = useFeatureT();
  const viewerRef = useRef<HTMLElement>(null);
  const fullscreenTriggerRef = useRef<HTMLElement | null>(null);
  const [internalOverlayVisible, setInternalOverlayVisible] = useState(false);
  const [overlayFailed, setOverlayFailed] = useState(false);
  const [scale, setScale] = useState(1);
  const [fullscreenActive, setFullscreenActive] = useState(false);
  const [enlargedFallback, setEnlargedFallback] = useState(false);
  const original = useProtectedMedia(originalEndpoint);
  const overlayVisible = controlledOverlayVisible ?? internalOverlayVisible;
  const overlay = useProtectedMedia(overlayAvailable && overlayVisible ? overlayEndpoint : null);
  const isEnlarged = fullscreenActive || enlargedFallback;
  const canToggleOverlay = overlayAvailable && Boolean(overlayEndpoint);

  useEffect(() => {
    setInternalOverlayVisible(false);
    onOverlayVisibilityChange?.(false);
    setOverlayFailed(false);
    setScale(1);
  }, [originalEndpoint, overlayEndpoint, overlayAvailable, onOverlayVisibilityChange]);

  useEffect(() => {
    if (overlayVisible && overlay.error) {
      setInternalOverlayVisible(false);
      onOverlayVisibilityChange?.(false);
      setOverlayFailed(true);
    }
  }, [onOverlayVisibilityChange, overlay.error, overlayVisible]);

  useEffect(() => {
    const onFullscreenChange = () => {
      const active = document.fullscreenElement === viewerRef.current;
      setFullscreenActive(active);
      if (!active && !enlargedFallback) window.setTimeout(() => fullscreenTriggerRef.current?.focus(), 0);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, [enlargedFallback]);

  useEffect(() => {
    if (!enlargedFallback) return undefined;
    const viewer = viewerRef.current;
    window.setTimeout(() => viewer?.querySelector<HTMLElement>("button")?.focus(), 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setEnlargedFallback(false); return; }
      if (event.key !== "Tab" || !viewer) return;
      const focusable = Array.from(viewer.querySelectorAll<HTMLElement>("button:not(:disabled), [tabindex]:not([tabindex='-1'])"));
      if (!focusable.length) return;
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("keydown", onKeyDown); window.setTimeout(() => fullscreenTriggerRef.current?.focus(), 0); };
  }, [enlargedFallback]);

  if (original.isLoading) return <div className="protected-xray-loading" role="status">{t("loadingOriginal")}</div>;
  if (original.error) return <StatePanel state="error" title={t("xrayUnavailable")} action={<Button variant="secondary" type="button" onClick={original.retry}>{t("retry")}</Button>} />;
  if (!original.url) return <StatePanel state="notFound" title={t("xrayUnavailable")} />;

  const setBoundedScale = (next: number) => setScale(Math.min(MAX_SCALE, Math.max(MIN_SCALE, next)));
  const setOverlay = (visible: boolean) => { setOverlayFailed(false); setInternalOverlayVisible(visible); onOverlayVisibilityChange?.(visible); };

  async function toggleFullscreen() {
    if (document.fullscreenElement === viewerRef.current && document.exitFullscreen) { await document.exitFullscreen(); return; }
    if (enlargedFallback) { setEnlargedFallback(false); return; }
    fullscreenTriggerRef.current = document.activeElement as HTMLElement;
    if (viewerRef.current?.requestFullscreen) {
      try { await viewerRef.current.requestFullscreen(); return; } catch { setEnlargedFallback(true); return; }
    }
    setEnlargedFallback(true);
  }

  return <figure ref={viewerRef} className={["protected-xray-viewer", enlargedFallback ? "is-enlarged" : ""].filter(Boolean).join(" ")} role={enlargedFallback ? "dialog" : undefined} aria-modal={enlargedFallback || undefined} aria-label={enlargedFallback ? originalLabel : undefined}>
    {isEnlarged ? <div className="protected-xray-fullscreen-overlay-control"><OverlaySwitch visible={overlayVisible} available={canToggleOverlay} onToggle={() => setOverlay(!overlayVisible)} /></div> : null}
    <div className="protected-xray-canvas"><div className="protected-xray-media" data-scale={scale.toFixed(2)} style={{ transform: `scale(${scale})` }}><img className="protected-xray-original" src={original.url} alt={originalAlt} />{overlayVisible && overlay.url ? <img className="protected-xray-overlay" src={overlay.url} alt="" aria-hidden="true" /> : null}</div>{overlayVisible && overlay.isLoading ? <span className="protected-xray-overlay-state" role="status">{t("loadingOverlay")}</span> : null}</div>
    <figcaption className="protected-xray-toolbar"><span className="protected-xray-label">{originalLabel}</span><div className="protected-xray-toolbar-actions">
      <Button variant="secondary" type="button" onClick={() => setBoundedScale(scale + SCALE_STEP)} disabled={scale >= MAX_SCALE}><Plus size={17} />{t("zoomIn")}</Button>
      <Button variant="secondary" type="button" onClick={() => setBoundedScale(scale - SCALE_STEP)} disabled={scale <= MIN_SCALE}><Minus size={17} />{t("zoomOut")}</Button>
      <Button variant="secondary" type="button" onClick={() => { setScale(1); setOverlay(false); }}><RotateCcw size={17} />{t("resetViewer")}</Button>
      <Button variant="secondary" type="button" onClick={() => setScale(1)}><Scan size={17} />{t("fitToView")}</Button>
      <Button variant="secondary" type="button" aria-pressed={isEnlarged} onClick={() => void toggleFullscreen()}>{isEnlarged ? <Minimize2 size={17} /> : <Maximize2 size={17} />}{isEnlarged ? t("exitFullscreen") : t("fullscreen")}</Button>
    </div><output className="protected-xray-scale" aria-live="polite">{Math.round(scale * 100)}%</output></figcaption>
    {overlayFailed ? <p className="protected-xray-overlay-error" role="alert">{t("overlayUnavailable")}</p> : null}
  </figure>;
}

export function OverlaySwitch({ visible, available, onToggle }: { visible: boolean; available: boolean; onToggle: () => void }) {
  const t = useFeatureT();
  return <button className="active-xray-overlay-switch" type="button" role="switch" aria-checked={visible} aria-label={`${t("aiOverlay")}: ${visible ? t("aiOverlayOn") : t("aiOverlayOff")}`} disabled={!available} title={!available ? t("noOverlayAvailable") : undefined} onClick={onToggle}><span className="active-xray-overlay-label">{t("aiOverlay")}</span><span className="active-xray-overlay-value">{visible ? t("aiOverlayOn") : t("aiOverlayOff")}</span><span className="active-xray-overlay-track" aria-hidden="true"><span /></span></button>;
}
