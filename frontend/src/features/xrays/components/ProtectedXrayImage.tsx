import { useState } from "react";

import { Button, StatePanel } from "../../../components/v2";
import { useFeatureT } from "../../../layouts/i18n";
import { useProtectedMedia } from "../hooks/useProtectedMedia";

interface ProtectedXrayImageProps { endpoint: string; alt: string; label: string; }

export function ProtectedXrayImage({ endpoint, alt, label }: ProtectedXrayImageProps) {
  const t = useFeatureT();
  const media = useProtectedMedia(endpoint);
  const [decodeError, setDecodeError] = useState(false);
  if (media.isLoading) return <StatePanel state="loading" title={t("loadingXrays")} />;
  if (media.error || decodeError) return <StatePanel state="error" title={t("xrayUnavailable")} action={<Button type="button" variant="secondary" onClick={() => { setDecodeError(false); media.retry(); }}>{t("retry")}</Button>} />;
  if (!media.url) return <StatePanel state="notFound" title={t("xrayUnavailable")} />;
  return <figure className="protected-xray-image xray-viewer"><figcaption>{label}</figcaption><img src={media.url} alt={alt} onError={() => setDecodeError(true)} /></figure>;
}
