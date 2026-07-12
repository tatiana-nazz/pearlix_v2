import { beforeEach, describe, expect, it, vi } from "vitest";

const { updatePreferences } = vi.hoisted(() => ({ updatePreferences: vi.fn() }));
vi.mock("../api/endpoints/auth", () => ({ authApi: { login: vi.fn(), logout: vi.fn(), me: vi.fn(), changePassword: vi.fn(), updatePreferences } }));

import { useAuthStore } from "./authStore";
import type { AuthUser } from "../types/auth";

const user: AuthUser = { id: 7, email:"doctor@pearlix.test", full_name:"Dr Noor", role:"DOCTOR", is_active:true, must_change_password:false, password_changed_at:null, theme_preference:"SYSTEM", language_preference:"EN" };

describe("Phase 14C preference persistence", () => {
  beforeEach(() => { updatePreferences.mockReset(); useAuthStore.setState({ accessToken:"access", refreshToken:"refresh", user, role:"DOCTOR", isAuthenticated:true, authStatus:"authenticated", mustChangePassword:false }); });

  it("persists theme and language preferences through the authenticated endpoint", async () => {
    updatePreferences.mockResolvedValue({ ...user, theme_preference:"DARK", language_preference:"AR" });
    await useAuthStore.getState().updatePreferences({ theme_preference:"DARK", language_preference:"AR" });
    expect(updatePreferences).toHaveBeenCalledWith({ theme_preference:"DARK", language_preference:"AR" });
    expect(useAuthStore.getState().user?.theme_preference).toBe("DARK");
    expect(useAuthStore.getState().user?.language_preference).toBe("AR");
  });

  it("rolls back a failed preference write without losing authenticated session state", async () => {
    updatePreferences.mockRejectedValue(new Error("offline"));
    await expect(useAuthStore.getState().updatePreferences({ theme_preference:"LIGHT" })).rejects.toThrow("offline");
    expect(useAuthStore.getState().user).toEqual(user);
    expect(useAuthStore.getState().accessToken).toBe("access");
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });
});
