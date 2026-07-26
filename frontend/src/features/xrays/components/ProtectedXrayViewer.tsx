import { useEffect, useState } from "react";

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
}

export function ProtectedXrayViewer({
  originalEndpoint,
  overlayEndpoint,
  overlayAvailable = false,
  originalAlt,
  originalLabel,
}: ProtectedXrayViewerProps) {
  const c = xrayCopy(useAuthStore((state) => state.user?.language_preference));
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [overlayFailed, setOverlayFailed] = useState(false);
  const original = useProtectedMedia(originalEndpoint);
  const overlay = useProtectedMedia(overlayAvailable && overlayVisible ? overlayEndpoint : null);

  useEffect(() => {
    setOverlayVisible(false);
    setOverlayFailed(false);
  }, [originalEndpoint, overlayEndpoint, overlayAvailable]);

  useEffect(() => {
    if (overlayVisible && overlay.error) {
      setOverlayVisible(false);
      setOverlayFailed(true);
    }
  }, [overlay.error, overlayVisible]);

  if (original.isLoading) {
    return <div className="protected-xray-loading" role="status" aria-live="polite">{c.loadingOriginal}</div>;
  }
  if (original.error) {
    return <StatePanel state="error" title={c.protectedUnavailable} action={<Button variant="secondary" type="button" onClick={original.retry}>{c.retry}</Button>} />;
  }
  if (!original.url) return <StatePanel state="notFound" title={c.protectedUnavailable} />;

  const toggleOverlay = () => {
    setOverlayFailed(false);
    setOverlayVisible((visible) => !visible);
  };

  return (
    <figure className="protected-xray-viewer">
      <figcaption className="protected-xray-toolbar">
        <span>{originalLabel}</span>
        {overlayAvailable && overlayEndpoint ? (
          <Button variant="secondary" type="button" aria-pressed={overlayVisible} onClick={toggleOverlay}>
            {overlayVisible ? c.hideOverlay : c.showOverlay}
          </Button>
        ) : null}
      </figcaption>
      <div className="protected-xray-canvas">
        <img className="protected-xray-original" src={original.url} alt={originalAlt} />
        {overlayVisible && overlay.url ? <img className="protected-xray-overlay" src={overlay.url} alt="" aria-hidden="true" /> : null}
        {overlayVisible && overlay.isLoading ? <span className="protected-xray-overlay-state" role="status">{c.loadingOverlay}</span> : null}
      </div>
      {overlayFailed ? <p className="protected-xray-overlay-error" role="alert">{c.overlayUnavailable}</p> : null}
    </figure>
  );
}
