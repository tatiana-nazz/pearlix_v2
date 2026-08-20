import { create } from "zustand";
import { persist } from "zustand/middleware";

import { authApi } from "../api/endpoints/auth";
import { configureAuthAccessors } from "../api/http";
import type { AuthStatus, AuthUser, ChangePasswordPayload, LanguagePreference, LoginPayload, ThemePreference, UserRole } from "../types/auth";

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  role: UserRole | null;
  mustChangePassword: boolean;
  isAuthenticated: boolean;
  authStatus: AuthStatus;
  login: (payload: LoginPayload) => Promise<AuthUser>;
  logout: () => Promise<void>;
  loadMe: () => Promise<AuthUser | null>;
  changePassword: (payload: ChangePasswordPayload) => Promise<AuthUser>;
  updatePreferences: (preferences: Partial<Pick<AuthUser, "theme_preference" | "language_preference">>) => Promise<AuthUser>;
  setTokens: (accessToken: string, refreshToken?: string | null) => void;
  clearAuth: () => void;
}

function deriveAuth(user: AuthUser | null, accessToken: string | null) {
  return {
    user,
    role: user?.role ?? null,
    mustChangePassword: Boolean(user?.must_change_password),
    isAuthenticated: Boolean(user && accessToken),
    authStatus: user && accessToken ? ("authenticated" as const) : ("anonymous" as const),
  };
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      role: null,
      mustChangePassword: false,
      isAuthenticated: false,
      authStatus: "unknown",
      async login(payload) {
        const response = await authApi.login(payload);
        set({
          accessToken: response.access,
          refreshToken: response.refresh,
          ...deriveAuth(response.user, response.access),
        });
        return response.user;
      },
      async logout() {
        const refresh = get().refreshToken;
        if (refresh) {
          try {
            await authApi.logout(refresh);
          } catch {
            // Local auth state must clear even if the server token is already invalid.
          }
        }
        get().clearAuth();
      },
      async loadMe() {
        if (!get().accessToken) {
          set({ authStatus: "anonymous" });
          return null;
        }
        try {
          const user = await authApi.me();
          set({ ...deriveAuth(user, get().accessToken) });
          return user;
        } catch {
          get().clearAuth();
          return null;
        }
      },
      async changePassword(payload) {
        const response = await authApi.changePassword(payload);
        set({
          accessToken: response.access,
          refreshToken: response.refresh,
          ...deriveAuth(response.user, response.access),
        });
        return response.user;
      },
      async updatePreferences(preferences) {
        const previous = get().user;
        if (!previous) throw new Error("You must be signed in to update preferences.");
        const optimistic = { ...previous, ...preferences };
        set({ user: optimistic, role: optimistic.role });
        try {
          const user = await authApi.updatePreferences(preferences);
          set({ ...deriveAuth(user, get().accessToken) });
          return user;
        } catch (error) {
          set({ user: previous, role: previous.role });
          throw error;
        }
      },
      setTokens(accessToken, refreshToken) {
        set((state) => ({
          accessToken,
          refreshToken: refreshToken === undefined ? state.refreshToken : refreshToken,
          isAuthenticated: Boolean(state.user && accessToken),
          authStatus: state.user && accessToken ? "authenticated" : state.authStatus,
        }));
      },
      clearAuth() {
        set({
          accessToken: null,
          refreshToken: null,
          user: null,
          role: null,
          mustChangePassword: false,
          isAuthenticated: false,
          authStatus: "anonymous",
        });
      },
    }),
    {
      name: "pearlix-auth",
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.accessToken) {
          state.authStatus = "unknown";
        } else if (state) {
          state.authStatus = "anonymous";
        }
      },
    },
  ),
);

configureAuthAccessors({
  getAccessToken: () => useAuthStore.getState().accessToken,
  getRefreshToken: () => useAuthStore.getState().refreshToken,
  setAccessToken: (token) => useAuthStore.getState().setTokens(token),
  clearAuth: () => useAuthStore.getState().clearAuth(),
});
