import { beforeEach, describe, expect, it, vi } from "vitest";

const { changePassword, login, logout, me, updatePreferences } = vi.hoisted(() => ({
  changePassword: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  me: vi.fn(),
  updatePreferences: vi.fn(),
}));

vi.mock("../api/endpoints/auth", () => ({
  authApi: { changePassword, login, logout, me, updatePreferences },
}));

import { queryClient } from "../app/queryClient";
import type { AuthUser } from "../types/auth";
import {
  AUTH_SESSION_EVENT_STORAGE_KEY,
  type AuthSessionEventType,
} from "./authSessionSync";
import { useAuthStore } from "./authStore";

const AUTH_STORAGE_KEY = "pearlix-auth";

function token(authSessionId: string) {
  const encode = (value: object) => btoa(JSON.stringify(value))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  return `${encode({ alg: "none", typ: "JWT" })}.${encode({ auth_session_id: authSessionId })}.signature`;
}

function user(id = 17): AuthUser {
  return {
    id,
    email: `doctor-${id}@pearlix.test`,
    full_name: `Doctor ${id}`,
    role: "DOCTOR",
    is_active: true,
    must_change_password: false,
    password_changed_at: "2026-08-20T10:00:00Z",
    theme_preference: "SYSTEM",
    language_preference: "EN",
  };
}

function authenticate(authSessionId: string, authUser = user()) {
  useAuthStore.setState({
    accessToken: token(authSessionId),
    refreshToken: token(authSessionId),
    user: authUser,
    role: authUser.role,
    mustChangePassword: false,
    isAuthenticated: true,
    authStatus: "authenticated",
  });
}

function dispatchRemoteEvent(
  type: AuthSessionEventType,
  authSessionId: string,
) {
  window.dispatchEvent(new StorageEvent("storage", {
    key: AUTH_SESSION_EVENT_STORAGE_KEY,
    newValue: JSON.stringify({
      type,
      sourceId: "remote-tab-id",
      emittedAt: Date.now(),
      authSessionId,
    }),
  }));
}

describe("sibling-tab authentication synchronization", () => {
  beforeEach(() => {
    localStorage.clear();
    queryClient.clear();
    logout.mockReset();
    useAuthStore.setState({
      accessToken: null,
      refreshToken: null,
      user: null,
      role: null,
      mustChangePassword: false,
      isAuthenticated: false,
      authStatus: "anonymous",
    });
  });

  it.each(["LOGOUT", "SESSION_REVOKED"] as const)(
    "immediately clears identity and PHI cache for a matching %s event",
    (type) => {
      authenticate("family-a");
      queryClient.setQueryData(["patient", 81, "xrays"], { phi: "private" });

      dispatchRemoteEvent(type, "family-a");

      expect(useAuthStore.getState()).toMatchObject({
        accessToken: null,
        refreshToken: null,
        user: null,
        isAuthenticated: false,
        authStatus: "anonymous",
      });
      expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    },
  );

  it("does not clear an independent login family", () => {
    authenticate("family-b");
    queryClient.setQueryData(["dashboard", "doctor"], { owner: "family-b" });

    dispatchRemoteEvent("LOGOUT", "family-a");

    expect(useAuthStore.getState()).toMatchObject({
      accessToken: token("family-b"),
      user: user(),
      isAuthenticated: true,
    });
    expect(queryClient.getQueryData(["dashboard", "doctor"])).toEqual({ owner: "family-b" });
  });

  it("clears the old tab on identity change without overwriting the origin tab's replacement family", () => {
    authenticate("family-old");
    queryClient.setQueryData(["billing-handoffs"], { phi: "old-identity" });
    const replacementSnapshot = JSON.stringify({
      state: {
        accessToken: token("family-new"),
        refreshToken: token("family-new"),
      },
      version: 0,
    });
    localStorage.setItem(AUTH_STORAGE_KEY, replacementSnapshot);
    const setItem = vi.spyOn(Storage.prototype, "setItem");

    dispatchRemoteEvent("IDENTITY_CHANGED", "family-old");

    expect(useAuthStore.getState()).toMatchObject({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,
    });
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBe(replacementSnapshot);
    expect(setItem.mock.calls.filter(([key]) => key === AUTH_SESSION_EVENT_STORAGE_KEY)).toHaveLength(0);
    setItem.mockRestore();
  });

  it("publishes logout metadata without tokens or user PII", async () => {
    authenticate("family-a");
    logout.mockResolvedValue(undefined);
    const setItem = vi.spyOn(Storage.prototype, "setItem");

    await useAuthStore.getState().logout();

    const published = setItem.mock.calls
      .filter(([key]) => key === AUTH_SESSION_EVENT_STORAGE_KEY)
      .map(([, value]) => JSON.parse(String(value)) as Record<string, unknown>);
    expect(published).toHaveLength(1);
    expect(published[0]).toMatchObject({ type: "LOGOUT", authSessionId: "family-a" });
    expect(JSON.stringify(published[0])).not.toContain("signature");
    expect(JSON.stringify(published[0])).not.toContain("@pearlix.test");
    setItem.mockRestore();
  });

  it("ignores malformed, untargeted, and stale events", () => {
    authenticate("family-a");
    window.dispatchEvent(new StorageEvent("storage", {
      key: AUTH_SESSION_EVENT_STORAGE_KEY,
      newValue: "not-json",
    }));
    window.dispatchEvent(new StorageEvent("storage", {
      key: AUTH_SESSION_EVENT_STORAGE_KEY,
      newValue: JSON.stringify({
        type: "LOGOUT",
        sourceId: "remote-tab-id",
        emittedAt: Date.now() - 120_000,
        authSessionId: "family-a",
      }),
    }));

    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });
});
