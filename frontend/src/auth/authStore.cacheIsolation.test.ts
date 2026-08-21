import { beforeEach, describe, expect, it, vi } from "vitest";

const { changePassword, login, logout, me, updatePreferences } = vi.hoisted(() => ({
  changePassword: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  me: vi.fn(),
  updatePreferences: vi.fn(),
}));

vi.mock("../api/endpoints/auth", () => ({
  authApi: {
    changePassword,
    login,
    logout,
    me,
    updatePreferences,
  },
}));

import { queryClient } from "../app/queryClient";
import { ApiClientError } from "../api/errors";
import type { AuthUser, UserRole } from "../types/auth";
import { useAuthStore } from "./authStore";

function authUser(id: number, role: UserRole): AuthUser {
  return {
    id,
    email: `user-${id}@pearlix.test`,
    full_name: `User ${id}`,
    role,
    is_active: true,
    must_change_password: false,
    password_changed_at: "2026-08-20T10:00:00Z",
    theme_preference: "SYSTEM",
    language_preference: "EN",
  };
}

const sensitiveQueryKeys = [
  ["dashboard", "doctor"],
  ["patients", { search: "private" }],
  ["visits", 44],
  ["appointments", "week"],
  ["xrays", 72],
  ["ai-results", 72],
  ["billing-handoffs", "open"],
  ["working-shifts", 17],
] as const;

function seedSensitiveCache(owner: string) {
  sensitiveQueryKeys.forEach((queryKey) => {
    queryClient.setQueryData(queryKey, { owner, phi: `${owner}-private` });
  });
}

function setAuthenticated(user: AuthUser) {
  useAuthStore.setState({
    accessToken: `access-${user.id}`,
    refreshToken: `refresh-${user.id}`,
    user,
    role: user.role,
    mustChangePassword: false,
    isAuthenticated: true,
    authStatus: "authenticated",
  });
}

describe("authenticated React Query cache isolation", () => {
  beforeEach(() => {
    localStorage.clear();
    queryClient.clear();
    login.mockReset();
    logout.mockReset();
    me.mockReset();
    changePassword.mockReset();
    updatePreferences.mockReset();
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

  it.each([
    ["Doctor A to Doctor B", authUser(11, "DOCTOR"), authUser(12, "DOCTOR")],
    ["Admin to Staff", authUser(21, "ADMIN"), authUser(22, "STAFF")],
  ])("clears every sensitive cache on logout and %s login", async (_label, first, second) => {
    setAuthenticated(first);
    seedSensitiveCache(first.email);
    logout.mockResolvedValue(undefined);

    await useAuthStore.getState().logout();

    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);

    login.mockResolvedValue({ access: `access-${second.id}`, refresh: `refresh-${second.id}`, user: second });
    await useAuthStore.getState().login({ email: second.email, password: "ValidPassword!2026" });

    sensitiveQueryKeys.forEach((queryKey) => {
      expect(queryClient.getQueryData(queryKey)).toBeUndefined();
    });
  });

  it("clears identity and sensitive queries before a pending server logout resolves", async () => {
    const user = authUser(25, "DOCTOR");
    setAuthenticated(user);
    seedSensitiveCache(user.email);
    let resolveLogout!: () => void;
    logout.mockImplementation(() => new Promise<void>((resolve) => {
      resolveLogout = resolve;
    }));

    const pendingLogout = useAuthStore.getState().logout();

    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(useAuthStore.getState()).toMatchObject({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,
    });

    expect(logout).toHaveBeenCalledWith(`refresh-${user.id}`);
    resolveLogout();
    await pendingLogout;
  });

  it("clears revoked identity data before a replacement identity becomes observable", async () => {
    const first = authUser(31, "DOCTOR");
    const second = authUser(32, "DOCTOR");
    setAuthenticated(first);
    seedSensitiveCache(first.email);

    useAuthStore.getState().clearAuth();
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);

    seedSensitiveCache("unexpected-stale-data");
    login.mockResolvedValue({ access: "access-32", refresh: "refresh-32", user: second });
    let cacheWasEmptyAtIdentityChange = false;
    const unsubscribe = useAuthStore.subscribe((state, previous) => {
      if (state.user?.id === second.id && previous.user?.id !== second.id) {
        cacheWasEmptyAtIdentityChange = queryClient.getQueryCache().getAll().length === 0;
      }
    });

    await useAuthStore.getState().login({ email: second.email, password: "ValidPassword!2026" });
    unsubscribe();

    expect(cacheWasEmptyAtIdentityChange).toBe(true);
  });

  it("isolates B from a deferred A mutation that settles after the identity switch", async () => {
    const first = authUser(33, "DOCTOR");
    const second = authUser(34, "DOCTOR");
    setAuthenticated(first);
    const retiredClient = queryClient;
    let resolveMutation!: () => void;
    const deferredMutation = new Promise<void>((resolve) => {
      resolveMutation = resolve;
    }).then(() => {
      retiredClient.setQueryData(["ai-results", 733], {
        owner: first.email,
        phi: "late-A-result",
      });
    });

    useAuthStore.getState().clearAuth();
    login.mockResolvedValue({ access: "access-34", refresh: "refresh-34", user: second });
    await useAuthStore.getState().login({
      email: second.email,
      password: "ValidPassword!2026",
    });
    const secondIdentityClient = queryClient;

    resolveMutation();
    await deferredMutation;

    expect(secondIdentityClient).not.toBe(retiredClient);
    expect(secondIdentityClient.getQueryData(["ai-results", 733])).toBeUndefined();
    expect(retiredClient.getQueryData(["ai-results", 733])).toEqual({
      owner: first.email,
      phi: "late-A-result",
    });
  });

  it("clears cache before a direct authenticated switch to another user", async () => {
    const first = authUser(35, "DOCTOR");
    const second = authUser(36, "DOCTOR");
    setAuthenticated(first);
    seedSensitiveCache(first.email);
    login.mockResolvedValue({ access: "access-36", refresh: "refresh-36", user: second });
    let cacheWasEmptyAtIdentityChange = false;
    const unsubscribe = useAuthStore.subscribe((state, previous) => {
      if (state.user?.id === second.id && previous.user?.id === first.id) {
        cacheWasEmptyAtIdentityChange = queryClient.getQueryCache().getAll().length === 0;
      }
    });

    await useAuthStore.getState().login({ email: second.email, password: "ValidPassword!2026" });
    unsubscribe();

    expect(cacheWasEmptyAtIdentityChange).toBe(true);
  });

  it("clears cache if loadMe observes a different authenticated identity", async () => {
    const first = authUser(41, "ADMIN");
    const second = authUser(42, "STAFF");
    setAuthenticated(first);
    seedSensitiveCache(first.email);
    me.mockResolvedValue(second);

    await useAuthStore.getState().loadMe();

    expect(useAuthStore.getState().user).toEqual(second);
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });

  it.each([0, 500, 503])("preserves a potentially valid session on transient /me status %s", async (status) => {
    const user = authUser(43, "DOCTOR");
    setAuthenticated(user);
    me.mockRejectedValue(new ApiClientError({ code: "TEMPORARY", message: "Temporarily unavailable.", details: {}, status }));
    await useAuthStore.getState().loadMe();
    expect(useAuthStore.getState()).toMatchObject({
      accessToken: "access-43",
      refreshToken: "refresh-43",
      user,
      authStatus: "restoration_error",
    });
  });

  it.each([401, 403])("clears an invalid session on authoritative /me status %s", async (status) => {
    const user = authUser(44, "DOCTOR");
    setAuthenticated(user);
    me.mockRejectedValue(new ApiClientError({ code: "AUTH_REQUIRED", message: "Authentication required.", details: {}, status }));
    await useAuthStore.getState().loadMe();
    expect(useAuthStore.getState()).toMatchObject({ accessToken: null, refreshToken: null, user: null, authStatus: "anonymous" });
  });

  it("recovers from a transient restoration failure on one explicit retry", async () => {
    const user = authUser(54, "STAFF");
    setAuthenticated(user);
    me.mockRejectedValueOnce(new ApiClientError({ code: "NETWORK_ERROR", message: "Network request failed.", details: {}, status: 0 }));
    await useAuthStore.getState().loadMe();
    me.mockResolvedValueOnce(user);
    await useAuthStore.getState().loadMe();
    expect(useAuthStore.getState()).toMatchObject({ user, authStatus: "authenticated", isAuthenticated: true });
  });

  it("clears Admin cache if the same account is observed after a role demotion", async () => {
    const admin = authUser(45, "ADMIN");
    const demoted = authUser(45, "STAFF");
    setAuthenticated(admin);
    seedSensitiveCache(admin.email);
    me.mockResolvedValue(demoted);

    await useAuthStore.getState().loadMe();

    expect(useAuthStore.getState()).toMatchObject({ user: demoted, role: "STAFF" });
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });

  it("discards a delayed A loadMe response after B becomes authenticated", async () => {
    const first = authUser(46, "DOCTOR");
    const second = authUser(47, "DOCTOR");
    setAuthenticated(first);
    let resolveMe!: (user: AuthUser) => void;
    me.mockImplementation(() => new Promise<AuthUser>((resolve) => {
      resolveMe = resolve;
    }));

    const pendingMe = useAuthStore.getState().loadMe();
    useAuthStore.getState().clearAuth();
    login.mockResolvedValue({ access: "access-47", refresh: "refresh-47", user: second });
    await useAuthStore.getState().login({
      email: second.email,
      password: "ValidPassword!2026",
    });
    resolveMe(first);
    await pendingMe;

    expect(useAuthStore.getState()).toMatchObject({
      accessToken: "access-47",
      refreshToken: "refresh-47",
      user: second,
    });
  });

  it("discards delayed A password-replacement credentials after B login", async () => {
    const first = authUser(48, "STAFF");
    const second = authUser(49, "STAFF");
    setAuthenticated(first);
    let resolveChange!: (response: {
      access: string;
      refresh: string;
      user: AuthUser;
    }) => void;
    changePassword.mockImplementation(() => new Promise((resolve) => {
      resolveChange = resolve;
    }));

    const pendingChange = useAuthStore.getState().changePassword({
      current_password: "Temporary!2026",
      new_password: "Replacement!2026",
    });
    useAuthStore.getState().clearAuth();
    login.mockResolvedValue({ access: "access-49", refresh: "refresh-49", user: second });
    await useAuthStore.getState().login({
      email: second.email,
      password: "ValidPassword!2026",
    });
    resolveChange({
      access: "late-access-48",
      refresh: "late-refresh-48",
      user: first,
    });

    await expect(pendingChange).rejects.toThrow("authentication session changed");
    expect(useAuthStore.getState()).toMatchObject({
      accessToken: "access-49",
      refreshToken: "refresh-49",
      user: second,
    });
  });

  it("does not let a delayed A preference failure roll B back to A", async () => {
    const first = authUser(52, "DOCTOR");
    const second = authUser(53, "DOCTOR");
    setAuthenticated(first);
    let rejectPreference!: (error: Error) => void;
    updatePreferences.mockImplementation(() => new Promise((_resolve, reject) => {
      rejectPreference = reject;
    }));

    const pendingPreference = useAuthStore.getState().updatePreferences({
      language_preference: "AR",
    });
    useAuthStore.getState().clearAuth();
    login.mockResolvedValue({ access: "access-53", refresh: "refresh-53", user: second });
    await useAuthStore.getState().login({
      email: second.email,
      password: "ValidPassword!2026",
    });
    rejectPreference(new Error("late A request failed"));

    await expect(pendingPreference).rejects.toThrow("late A request failed");
    expect(useAuthStore.getState()).toMatchObject({
      accessToken: "access-53",
      refreshToken: "refresh-53",
      user: second,
    });
  });

  it("preserves same-identity cache across mandatory password token rotation", async () => {
    const user = authUser(51, "STAFF");
    setAuthenticated({ ...user, must_change_password: true });
    seedSensitiveCache(user.email);
    changePassword.mockResolvedValue({
      access: "replacement-access",
      refresh: "replacement-refresh",
      user,
    });

    await useAuthStore.getState().changePassword({
      current_password: "Temporary!2026",
      new_password: "Replacement!2026",
    });

    expect(queryClient.getQueryCache().getAll()).toHaveLength(sensitiveQueryKeys.length);
    expect(useAuthStore.getState()).toMatchObject({
      accessToken: "replacement-access",
      refreshToken: "replacement-refresh",
      user,
    });
  });
});
