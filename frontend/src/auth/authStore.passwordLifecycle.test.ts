import { beforeEach, describe, expect, it, vi } from "vitest";

const { changePassword } = vi.hoisted(() => ({ changePassword: vi.fn() }));
vi.mock("../api/endpoints/auth", () => ({
  authApi: {
    changePassword,
    login: vi.fn(),
    logout: vi.fn(),
    me: vi.fn(),
    updatePreferences: vi.fn(),
  },
}));

import type { AuthUser } from "../types/auth";
import { useAuthStore } from "./authStore";

const changedUser: AuthUser = {
  id: 17,
  email: "staff@pearlix.test",
  full_name: "Staff User",
  role: "STAFF",
  is_active: true,
  must_change_password: false,
  password_changed_at: "2026-08-20T10:00:00Z",
  theme_preference: "SYSTEM",
  language_preference: "EN",
};

describe("password-change authority rotation", () => {
  beforeEach(() => {
    localStorage.clear();
    changePassword.mockReset();
    useAuthStore.setState({
      accessToken: "stale-access",
      refreshToken: "stale-refresh",
      user: { ...changedUser, must_change_password: true, password_changed_at: null },
      role: "STAFF",
      isAuthenticated: true,
      authStatus: "authenticated",
      mustChangePassword: true,
    });
  });

  it("installs the replacement token pair before leaving password-change mode", async () => {
    changePassword.mockResolvedValue({
      access: "replacement-access",
      refresh: "replacement-refresh",
      user: changedUser,
    });

    const returnedUser = await useAuthStore.getState().changePassword({
      current_password: "Temp0rary!4567",
      new_password: "N3w-Credential!9472",
    });

    expect(returnedUser).toEqual(changedUser);
    expect(useAuthStore.getState()).toMatchObject({
      accessToken: "replacement-access",
      refreshToken: "replacement-refresh",
      user: changedUser,
      role: "STAFF",
      isAuthenticated: true,
      authStatus: "authenticated",
      mustChangePassword: false,
    });
  });
});
