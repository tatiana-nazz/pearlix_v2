import axios, { type AxiosInstance, type AxiosRequestConfig, type Method } from "axios";

import type { QueryParams } from "../types/api";
import type { RefreshResponse } from "../types/auth";
import { ApiClientError, toApiClientError } from "./errors";

type TokenAccessors = {
  getAccessToken: () => string | null;
  getRefreshToken: () => string | null;
  setAccessToken: (token: string) => void;
  clearAuth: () => void;
};

const rawBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000/api";
export const apiBaseUrl = rawBaseUrl.replace(/\/+$/, "");

let tokenAccessors: TokenAccessors | null = null;
let refreshPromise: Promise<string> | null = null;

function endpointUrl(url: string): string {
  return url.startsWith("/api/") ? url.slice(4) : url;
}

const client: AxiosInstance = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    Accept: "application/json",
  },
});

export function configureAuthAccessors(accessors: TokenAccessors) {
  tokenAccessors = accessors;
}

client.interceptors.request.use((config) => {
  const token = tokenAccessors?.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

async function refreshAccessToken(): Promise<string> {
  if (!tokenAccessors?.getRefreshToken()) {
    throw new ApiClientError({ code: "AUTH_REQUIRED", message: "Authentication required.", details: {}, status: 401 });
  }

  if (!refreshPromise) {
    refreshPromise = axios
      .post<RefreshResponse>(`${apiBaseUrl}/auth/refresh/`, {
        refresh: tokenAccessors.getRefreshToken(),
      })
      .then((response) => {
        const access = response.data.access;
        tokenAccessors?.setAccessToken(access);
        return access;
      })
      .catch((error) => {
        tokenAccessors?.clearAuth();
        throw error;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

async function request<T>(method: Method, url: string, config: AxiosRequestConfig = {}): Promise<T> {
  try {
    const response = await client.request<T>({ ...config, method, url: endpointUrl(url) });
    return response.data;
  } catch (error) {
    const apiError = toApiClientError(error);
    const alreadyRetried = Boolean(config.headers && "X-Retry-After-Refresh" in config.headers);

    if (apiError.status === 401 && !alreadyRetried && tokenAccessors?.getRefreshToken()) {
      try {
        await refreshAccessToken();
        const retryHeaders = { ...(config.headers ?? {}), "X-Retry-After-Refresh": "true" };
        const response = await client.request<T>({ ...config, method, url: endpointUrl(url), headers: retryHeaders });
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
    request<Blob>("GET", url, {
      responseType: "blob",
    }),
};
