import { ApiClientError, normalizeApiError } from "../api/errors";

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    return error.message;
  }
  return normalizeApiError(error).message;
}
