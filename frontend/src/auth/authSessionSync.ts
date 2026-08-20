export const AUTH_SESSION_EVENT_STORAGE_KEY = "pearlix-auth-session-event";

export type AuthSessionEventType =
  | "LOGOUT"
  | "SESSION_REVOKED"
  | "IDENTITY_CHANGED";

export interface AuthSessionEvent {
  type: AuthSessionEventType;
  sourceId: string;
  emittedAt: number;
  authSessionId: string;
}

type AuthSessionEventListener = (event: AuthSessionEvent) => void;

const AUTH_SESSION_EVENT_MAX_AGE_MS = 60_000;
const VALID_EVENT_TYPES = new Set<AuthSessionEventType>([
  "LOGOUT",
  "SESSION_REVOKED",
  "IDENTITY_CHANGED",
]);

const sourceId = createSourceId();

function createSourceId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    try {
      return crypto.randomUUID();
    } catch {
      // Fall through for restricted browser contexts.
    }
  }
  return `tab-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function decodeJwtPayload(token: string | null): Record<string, unknown> | null {
  if (!token || typeof atob !== "function") return null;
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const decoded = JSON.parse(atob(padded));
    return decoded && typeof decoded === "object" ? decoded as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

export function getAuthSessionId(accessToken: string | null, refreshToken: string | null) {
  for (const token of [accessToken, refreshToken]) {
    const value = decodeJwtPayload(token)?.auth_session_id;
    if (typeof value === "string" && value.length > 0) return value;
  }
  return null;
}

function isValidEvent(value: unknown): value is AuthSessionEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Partial<AuthSessionEvent>;
  if (!event.type || !VALID_EVENT_TYPES.has(event.type)) return false;
  if (typeof event.sourceId !== "string" || !event.sourceId) return false;
  if (typeof event.emittedAt !== "number") return false;
  if (Math.abs(Date.now() - event.emittedAt) > AUTH_SESSION_EVENT_MAX_AGE_MS) return false;
  return Boolean(
    typeof event.authSessionId === "string"
    && event.authSessionId.length > 0
    && event.authSessionId.length <= 128,
  );
}

export function publishAuthSessionEvent(
  type: AuthSessionEventType,
  authSessionId: string | null,
) {
  if (typeof window === "undefined" || !authSessionId) return;
  const event: AuthSessionEvent = {
    type,
    sourceId,
    emittedAt: Date.now(),
    authSessionId,
  };
  try {
    // The short-lived key carries only an opaque server session UUID. Browser
    // storage events notify sibling documents but do not echo to this tab,
    // which prevents rebroadcast loops by construction.
    window.localStorage.setItem(AUTH_SESSION_EVENT_STORAGE_KEY, JSON.stringify(event));
    window.localStorage.removeItem(AUTH_SESSION_EVENT_STORAGE_KEY);
  } catch {
    // Backend revocation remains authoritative if browser storage is blocked.
  }
}

export function subscribeToAuthSessionEvents(listener: AuthSessionEventListener) {
  if (typeof window === "undefined") return () => undefined;
  const onStorage = (storageEvent: StorageEvent) => {
    if (
      storageEvent.key !== AUTH_SESSION_EVENT_STORAGE_KEY
      || !storageEvent.newValue
    ) return;
    try {
      const event: unknown = JSON.parse(storageEvent.newValue);
      if (isValidEvent(event) && event.sourceId !== sourceId) listener(event);
    } catch {
      // Ignore malformed or untrusted browser storage events.
    }
  };
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}
