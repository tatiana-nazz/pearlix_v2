import { useAuthStore } from "../../../auth/authStore";
import { Button, StatePanel } from "../../../components/v2";
import { useProtectedMedia } from "../hooks/useProtectedMedia";
import { xrayCopy } from "../i18n";

interface ProtectedXrayImageProps {
  endpoint: string;
  alt: string;
  label: string;
  enabled?: boolean;
}

export function ProtectedXrayImage({ endpoint, alt, label, enabled = true }: ProtectedXrayImageProps) {
  const c = xrayCopy(useAuthStore((state) => state.user?.language_preference));
  const media = useProtectedMedia(enabled ? endpoint : null);
  if (!enabled) return null;
  if (media.isLoading) return <div className="protected-xray-loading" role="status" aria-live="polite">Loading {label.toLowerCase()}…</div>;
  if (media.error) return <StatePanel state="error" title={c.protectedUnavailable} action={<Button variant="secondary" type="button" onClick={media.retry}>Retry</Button>} />;
  if (!media.url) return <StatePanel state="notFound" title={c.protectedUnavailable} />;
  return <figure className="protected-xray-image"><figcaption>{label}</figcaption><div className="protected-xray-canvas"><img src={media.url} alt={alt} /></div></figure>;
}
