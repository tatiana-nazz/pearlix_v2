import { useCallback, useEffect, useState } from "react";

import { api } from "../../../api/http";

interface ProtectedMediaState {
  url: string | null;
  contentType: string | null;
  isLoading: boolean;
  error: unknown;
}

export function useProtectedMedia(endpoint: string | null | undefined) {
  const [retryKey, setRetryKey] = useState(0);
  const [state, setState] = useState<ProtectedMediaState>({ url: null, contentType: null, isLoading: Boolean(endpoint), error: null });

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    setState({ url: null, contentType: null, isLoading: Boolean(endpoint), error: null });
    if (!endpoint) return undefined;

    void api.getBlob(endpoint).then((blob) => {
      if (!active) return;
      objectUrl = URL.createObjectURL(blob);
      setState({ url: objectUrl, contentType: blob.type || null, isLoading: false, error: null });
    }).catch((error) => {
      if (active) setState({ url: null, contentType: null, isLoading: false, error });
    });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [endpoint, retryKey]);

  return { ...state, retry: useCallback(() => setRetryKey((key) => key + 1), []) };
}
