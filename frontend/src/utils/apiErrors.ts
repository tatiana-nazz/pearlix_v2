import { ApiClientError, normalizeApiError } from "../api/errors";

type LoginLanguage = "EN" | "AR";

const loginCopy = {
  EN: {
    invalidCredentials: "Invalid email or password.",
    accountDisabled: "This account is disabled. Contact your clinic administrator.",
    unavailable: "The service is unavailable. Check that the local backend is running and try again.",
    unexpected: "The service returned an unexpected error. Try again later.",
  },
  AR: {
    invalidCredentials: "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
    accountDisabled: "هذا الحساب معطّل. تواصل مع مسؤول العيادة.",
    unavailable: "الخدمة غير متاحة. تأكد من تشغيل الخادم المحلي ثم حاول مرة أخرى.",
    unexpected: "أعادت الخدمة خطأً غير متوقع. حاول مرة أخرى لاحقاً.",
  },
} as const;

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    return error.message;
  }
  return normalizeApiError(error).message;
}

export function loginErrorMessage(error: unknown, language: LoginLanguage): string {
  const normalized = error instanceof ApiClientError ? error : normalizeApiError(error);
  const copy = loginCopy[language];
  if (normalized.code === "INVALID_CREDENTIALS") return copy.invalidCredentials;
  if (normalized.code === "ACCOUNT_DISABLED") return copy.accountDisabled;
  if (normalized.code === "NETWORK_ERROR") return copy.unavailable;
  if (normalized.status >= 500) return copy.unexpected;
  return normalized.message;
}
