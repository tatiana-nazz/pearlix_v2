import { ErrorState } from "../../../components/ErrorState";
import { LoadingState } from "../../../components/LoadingState";
import { useProtectedMedia } from "../hooks/useProtectedMedia";

interface ProtectedXrayImageProps { endpoint: string; alt: string; label: string; }

export function ProtectedXrayImage({ endpoint, alt, label }: ProtectedXrayImageProps) {
  const media = useProtectedMedia(endpoint);
  if (media.isLoading) return <LoadingState title={`Loading ${label.toLowerCase()}...`} />;
  if (media.error) return <ErrorState error={media.error} title={`${label} unavailable`} onRetry={media.retry} />;
  if (!media.url) return null;
  return <figure className="protected-xray-image"><figcaption>{label}</figcaption><img src={media.url} alt={alt} /></figure>;
}
