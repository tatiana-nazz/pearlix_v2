import axios, { type AxiosInstance, type AxiosRequestConfig, type Method } from "axios";

import type { QueryParams } from "../types/api";
import type { RefreshResponse } from "../types/auth";
import { ApiClientError, toApiClientError } from "./errors";

type TokenAccessors = {
  getAccessToken: () => string | null;
  getRefreshToken: () => string | null;
  getSessionRevision: () => number;
  setAccessToken: (token: string) => void;
  clearAuth: () => void;
};

type AuthSessionSnapshot = {
  accessToken: string | null;
  refreshToken: string | null;
  revision: number;
};

const rawBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000/api";
export const apiBaseUrl = rawBaseUrl.replace(/\/+$/, "");

function normalizeBlobEndpoint(url: string) {
  return apiBaseUrl.endsWith("/api") && url.startsWith("/api/") ? url.slice(4) : url;
}

let tokenAccessors: TokenAccessors | null = null;
let refreshAttempt: {
  promise: Promise<string>;
  refreshToken: string;
  revision: number;
} | null = null;

const client: AxiosInstance = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    Accept: "application/json",
  },
});

export function configureAuthAccessors(accessors: TokenAccessors) {
  tokenAccessors = accessors;
}

function captureAuthSession(): AuthSessionSnapshot {
  return {
    accessToken: tokenAccessors?.getAccessToken() ?? null,
    refreshToken: tokenAccessors?.getRefreshToken() ?? null,
    revision: tokenAccessors?.getSessionRevision() ?? 0,
  };
}

function isCurrentAuthSession(session: AuthSessionSnapshot) {
  return Boolean(
    tokenAccessors
    && tokenAccessors.getSessionRevision() === session.revision
    && tokenAccessors.getRefreshToken() === session.refreshToken,
  );
}

function sessionChangedError() {
  return new ApiClientError({
    code: "AUTH_SESSION_CHANGED",
    message: "Authentication session changed while the request was in progress.",
    details: {},
    status: 401,
  });
}

function bindAccessToken(config: AxiosRequestConfig, accessToken: string | null) {
  if (!accessToken) return config;
  return {
    ...config,
    headers: {
      ...(config.headers ?? {}),
      Authorization: `Bearer ${accessToken}`,
    },
  };
}

async function refreshAccessToken(session: AuthSessionSnapshot): Promise<string> {
  if (!session.refreshToken || !tokenAccessors) {
    throw new ApiClientError({ code: "AUTH_REQUIRED", message: "Authentication required.", details: {}, status: 401 });
  }
  if (!isCurrentAuthSession(session)) throw sessionChangedError();

  if (
    !refreshAttempt
    || refreshAttempt.revision !== session.revision
    || refreshAttempt.refreshToken !== session.refreshToken
  ) {
    const refreshToken = session.refreshToken;
    const revision = session.revision;
    const promise = axios
      .post<RefreshResponse>(`${apiBaseUrl}/auth/refresh/`, {
        refresh: refreshToken,
      })
      .then((response) => {
        if (!isCurrentAuthSession(session)) throw sessionChangedError();
        const access = response.data.access;
        tokenAccessors?.setAccessToken(access);
        return access;
      })
      .catch((error) => {
        if (isCurrentAuthSession(session)) tokenAccessors?.clearAuth();
        throw error;
      })
      .finally(() => {
        if (refreshAttempt?.promise === promise) refreshAttempt = null;
      });
    refreshAttempt = { promise, refreshToken, revision };
  }

  return refreshAttempt.promise;
}

async function request<T>(method: Method, url: string, config: AxiosRequestConfig = {}): Promise<T> {
  const initiatingSession = captureAuthSession();
  try {
    const response = await client.request<T>(
      bindAccessToken({ ...config, method, url }, initiatingSession.accessToken),
    );
    return response.data;
  } catch (error) {
    const apiError = toApiClientError(error);
    const alreadyRetried = Boolean(config.headers && "X-Retry-After-Refresh" in config.headers);

    if (
      apiError.status === 401
      && !alreadyRetried
      && initiatingSession.refreshToken
      && isCurrentAuthSession(initiatingSession)
    ) {
      try {
        const accessToken = await refreshAccessToken(initiatingSession);
        if (!isCurrentAuthSession(initiatingSession)) throw sessionChangedError();
        const retryHeaders = { ...(config.headers ?? {}), "X-Retry-After-Refresh": "true" };
        const response = await client.request<T>(
          bindAccessToken(
            { ...config, method, url, headers: retryHeaders },
            accessToken,
          ),
        );
        return response.data;
      } catch (refreshError) {
        throw toApiClientError(refreshError);
      }
    }

    throw apiError;
  }
}

function params(query?: QueryParams): AxiosRequestConfig {
  return { params: query };
}

export const api = {
  get: <T>(url: string, query?: QueryParams) => request<T>("GET", url, params(query)),
  post: <T, B = unknown>(url: string, body?: B) => request<T>("POST", url, { data: body }),
  patch: <T, B = unknown>(url: string, body?: B) => request<T>("PATCH", url, { data: body }),
  put: <T, B = unknown>(url: string, body?: B) => request<T>("PUT", url, { data: body }),
  delete: <T>(url: string) => request<T>("DELETE", url),
  postFormData: <T>(url: string, formData: FormData) =>
    request<T>("POST", url, {
      data: formData,
      headers: { "Content-Type": "multipart/form-data" },
    }),
  getBlob: (url: string) =>
    request<Blob>("GET", normalizeBlobEndpoint(url), {
      responseType: "blob",
    }),
};
