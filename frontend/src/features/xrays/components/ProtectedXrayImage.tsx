import { useState } from "react";

import { Button, StatePanel } from "../../../components/v2";
import { useFeatureT } from "../../../layouts/i18n";
import { useProtectedMedia } from "../hooks/useProtectedMedia";

interface ProtectedXrayImageProps { endpoint: string; alt: string; label: string; }

export function ProtectedXrayImage({ endpoint, alt, label }: ProtectedXrayImageProps) {
  const t = useFeatureT();
  const media = useProtectedMedia(endpoint);
  const [decodeError, setDecodeError] = useState(false);
  if (media.isLoading) return <div className="xray-canvas-state" role="status"><StatePanel state="loading" title={t("loadingXrays")} /></div>;
  if (media.error || decodeError) return <div className="xray-canvas-state" role="alert"><StatePanel state="error" title={t("xrayUnavailable")} action={<Button type="button" variant="secondary" onClick={() => { setDecodeError(false); media.retry(); }}>{t("retry")}</Button>} /></div>;
  if (!media.url) return <StatePanel state="notFound" title={t("xrayUnavailable")} />;
  return <figure className="protected-xray-image xray-viewer"><figcaption><span>{label}</span><span className="xray-protected-label">{t("protectedXray")}</span></figcaption><div className="xray-canvas"><img src={media.url} alt={alt} onError={() => setDecodeError(true)} /></div></figure>;
}
