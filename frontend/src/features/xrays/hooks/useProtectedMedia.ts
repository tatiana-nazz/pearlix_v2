import { useCallback, useEffect, useState } from "react";

import { api } from "../../../api/http";

interface ProtectedMediaState {
  url: string | null;
  contentType: string | null;
  isLoading: boolean;
  error: unknown;
}

function blobUrl(value: Blob): Promise<{ url: string; revoke: boolean }> {
  const blob = value instanceof Blob ? value : new Blob([value as unknown as BlobPart]);
  if (typeof URL.createObjectURL === "function") {
    try {
      return Promise.resolve({ url: URL.createObjectURL(blob), revoke: true });
    } catch {
      // Embedded Chromium can return a cross-realm value for a blob response.
      // FileReader is the standards-based, in-memory fallback.
    }
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("Unable to read protected media."));
    reader.onload = () => resolve({ url: String(reader.result), revoke: false });
    reader.readAsDataURL(blob);
  });
}

export function useProtectedMedia(endpoint: string | null | undefined) {
  const [retryKey, setRetryKey] = useState(0);
  const [state, setState] = useState<ProtectedMediaState>({ url: null, contentType: null, isLoading: Boolean(endpoint), error: null });

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    setState({ url: null, contentType: null, isLoading: Boolean(endpoint), error: null });
    if (!endpoint) return undefined;

    void api.getBlob(endpoint).then(async (blob) => {
      const object = await blobUrl(blob);
      if (!active) return;
      objectUrl = object.revoke ? object.url : null;
      setState({ url: object.url, contentType: blob.type || null, isLoading: false, error: null });
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
