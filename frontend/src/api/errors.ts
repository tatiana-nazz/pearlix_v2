import axios from "axios";

import type { ApiError } from "../types/api";

export class ApiClientError extends Error implements ApiError {
  code: string;
  details: Record<string, unknown>;
  status: number;

  constructor(error: ApiError) {
    super(error.message);
    this.name = "ApiClientError";
    this.code = error.code;
    this.details = error.details;
    this.status = error.status;
  }
}

export function normalizeApiError(error: unknown): ApiError {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status ?? 0;
    const data = error.response?.data;
    if (data && typeof data === "object" && "code" in data && "message" in data) {
      const payload = data as Partial<ApiError>;
      return {
        code: String(payload.code ?? "REQUEST_FAILED"),
        message: String(payload.message ?? "Request failed."),
        details: (payload.details as Record<string, unknown>) ?? {},
        status,
      };
    }

    return {
      code: status === 0 ? "NETWORK_ERROR" : "REQUEST_FAILED",
      message: status === 0 ? "Network request failed." : "Request failed.",
      details: {},
      status,
    };
  }

  return {
    code: "UNKNOWN_ERROR",
    message: error instanceof Error ? error.message : "Unexpected error.",
    details: {},
    status: 0,
  };
}

export function toApiClientError(error: unknown): ApiClientError {
  return error instanceof ApiClientError ? error : new ApiClientError(normalizeApiError(error));
}
