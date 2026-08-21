import { Maximize2, Minimize2, Minus, Plus, RotateCcw, Scan } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useAuthStore } from "../../../auth/authStore";
import { Button, StatePanel } from "../../../components/v2";
import { useProtectedMedia } from "../hooks/useProtectedMedia";
import { xrayCopy } from "../i18n";

interface ProtectedXrayViewerProps {
  originalEndpoint: string;
  overlayEndpoint?: string;
  overlayAvailable?: boolean;
  originalAlt: string;
  originalLabel: string;
  overlayVisible?: boolean;
  onOverlayVisibilityChange?: (visible: boolean) => void;
  showOverlayControl?: boolean;
}

const MIN_SCALE = 0.5;
const MAX_SCALE = 3;
const SCALE_STEP = 0.25;

export function ProtectedXrayViewer({
  originalEndpoint,
  overlayEndpoint,
  overlayAvailable = false,
  originalAlt,
  originalLabel,
  overlayVisible: controlledOverlayVisible,
  onOverlayVisibilityChange,
  showOverlayControl = true,
}: ProtectedXrayViewerProps) {
  const c = xrayCopy(useAuthStore((state) => state.user?.language_preference));
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
      if (event.key === "Escape") {
        event.preventDefault();
        setEnlargedFallback(false);
        return;
      }
      if (event.key !== "Tab" || !viewer) return;
      const focusable = Array.from(viewer.querySelectorAll<HTMLElement>("button:not(:disabled), [tabindex]:not([tabindex='-1'])"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.setTimeout(() => fullscreenTriggerRef.current?.focus(), 0);
    };
  }, [enlargedFallback]);

  if (original.isLoading) return <div className="protected-xray-loading" role="status" aria-live="polite">{c.loadingOriginal}</div>;
  if (original.error) return <StatePanel state="error" title={c.protectedUnavailable} action={<Button variant="secondary" type="button" onClick={original.retry}>{c.retry}</Button>} />;
  if (!original.url) return <StatePanel state="notFound" title={c.protectedUnavailable} />;

  const setBoundedScale = (next: number) => setScale(Math.min(MAX_SCALE, Math.max(MIN_SCALE, next)));
  const toggleOverlay = () => {
    setOverlayFailed(false);
    const next = !overlayVisible;
    setInternalOverlayVisible(next);
    onOverlayVisibilityChange?.(next);
  };
  const turnOverlayOff = () => {
    setInternalOverlayVisible(false);
    onOverlayVisibilityChange?.(false);
  };

  async function toggleFullscreen() {
    if (document.fullscreenElement === viewerRef.current && document.exitFullscreen) {
      await document.exitFullscreen();
      return;
    }
    if (enlargedFallback) {
      setEnlargedFallback(false);
      return;
    }
    fullscreenTriggerRef.current = document.activeElement as HTMLElement;
    if (viewerRef.current?.requestFullscreen) {
      try {
        await viewerRef.current.requestFullscreen();
        return;
      } catch {
        setEnlargedFallback(true);
        return;
      }
    }
    setEnlargedFallback(true);
  }

  return (
    <figure
      ref={viewerRef}
      className={["protected-xray-viewer", enlargedFallback ? "is-enlarged" : ""].filter(Boolean).join(" ")}
      role={enlargedFallback ? "dialog" : undefined}
      aria-modal={enlargedFallback || undefined}
      aria-label={enlargedFallback ? originalLabel : undefined}
    >
      {isEnlarged ? <div className="protected-xray-fullscreen-overlay-control">
        <button className="active-xray-overlay-switch" type="button" role="switch" aria-checked={overlayVisible} aria-label={`${c.aiOverlay}: ${overlayVisible ? c.overlayOn : c.overlayOff}`} disabled={!canToggleOverlay} title={!canToggleOverlay ? c.noOverlayAvailable : undefined} onClick={toggleOverlay}>
          <span className="active-xray-overlay-label">{c.aiOverlay}</span>
          <span className="active-xray-overlay-value">{overlayVisible ? c.overlayOn : c.overlayOff}</span>
          <span className="active-xray-overlay-track" aria-hidden="true"><span /></span>
        </button>
        {!canToggleOverlay ? <span className="protected-xray-fullscreen-overlay-unavailable">{c.noOverlayAvailable}</span> : null}
      </div> : null}
      <div className="protected-xray-canvas" data-testid="xray-pan-viewport">
        <div
          className="protected-xray-media"
          data-scale={scale.toFixed(2)}
          style={{ inlineSize: `${scale * 100}%` }}
        >
          <img className="protected-xray-original" src={original.url} alt={originalAlt} />
          {overlayVisible && overlay.url ? <img className="protected-xray-overlay" src={overlay.url} alt="" aria-hidden="true" /> : null}
        </div>
        {overlayVisible && overlay.isLoading ? <span className="protected-xray-overlay-state" role="status">{c.loadingOverlay}</span> : null}
      </div>
      <figcaption className="protected-xray-toolbar">
        <span className="protected-xray-label">{originalLabel}</span>
        <div className="protected-xray-toolbar-actions">
          <Button variant="secondary" type="button" onClick={() => setBoundedScale(scale + SCALE_STEP)} disabled={scale >= MAX_SCALE}><Plus size={17} aria-hidden="true" />{c.zoomIn}</Button>
          <Button variant="secondary" type="button" onClick={() => setBoundedScale(scale - SCALE_STEP)} disabled={scale <= MIN_SCALE}><Minus size={17} aria-hidden="true" />{c.zoomOut}</Button>
          <Button variant="secondary" type="button" onClick={() => { setScale(1); turnOverlayOff(); }}><RotateCcw size={17} aria-hidden="true" />{c.reset}</Button>
          {showOverlayControl && canToggleOverlay ? <Button variant="secondary" type="button" aria-pressed={overlayVisible} onClick={toggleOverlay}>{overlayVisible ? c.hideOverlay : c.showOverlay}</Button> : null}
          <Button variant="secondary" type="button" onClick={() => setScale(1)}><Scan size={17} aria-hidden="true" />{c.fitToView}</Button>
          <Button variant="secondary" type="button" aria-pressed={isEnlarged} onClick={() => void toggleFullscreen()}>{isEnlarged ? <Minimize2 size={17} aria-hidden="true" /> : <Maximize2 size={17} aria-hidden="true" />}{isEnlarged ? c.exitFullscreen : c.fullscreen}</Button>
        </div>
        <output className="protected-xray-scale" aria-live="polite">{Math.round(scale * 100)}%</output>
      </figcaption>
      {overlayAvailable ? <div className="xray-overlay-legend" aria-label={c.overlayLegend}>
        <strong>{c.overlayLegend}</strong>
        <span><i className="q1" aria-hidden="true" />{c.quadrantUpperRight}</span>
        <span><i className="q2" aria-hidden="true" />{c.quadrantUpperLeft}</span>
        <span><i className="q3" aria-hidden="true" />{c.quadrantLowerLeft}</span>
        <span><i className="q4" aria-hidden="true" />{c.quadrantLowerRight}</span>
        <span><i className="review" aria-hidden="true" />{c.reviewColor}</span>
      </div> : null}
      {overlayFailed ? <p className="protected-xray-overlay-error" role="alert">{c.overlayUnavailable}</p> : null}
    </figure>
  );
}
