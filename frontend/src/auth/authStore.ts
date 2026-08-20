import { create } from "zustand";
import { persist } from "zustand/middleware";

import { authApi } from "../api/endpoints/auth";
import { configureAuthAccessors } from "../api/http";
import { rotateAuthenticatedQueryClient } from "../app/queryClient";
import type { AuthStatus, AuthUser, ChangePasswordPayload, LanguagePreference, LoginPayload, ThemePreference, UserRole } from "../types/auth";

let authSessionRevision = 0;
let latestLoginRequest = 0;

class AuthSessionSupersededError extends Error {
  constructor() {
    super("The authentication session changed while the request was in progress.");
    this.name = "AuthSessionSupersededError";
  }
}

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
        const loginRequest = ++latestLoginRequest;
        const startingRevision = authSessionRevision;
        const response = await authApi.login(payload);
        if (loginRequest !== latestLoginRequest || startingRevision !== authSessionRevision) {
          throw new AuthSessionSupersededError();
        }
        const currentUser = get().user;
        if (currentUser?.id !== response.user.id || currentUser?.role !== response.user.role) {
          rotateAuthenticatedQueryClient();
        }
        authSessionRevision += 1;
        set({
          accessToken: response.access,
          refreshToken: response.refresh,
          ...deriveAuth(response.user, response.access),
        });
        return response.user;
      },
      async logout() {
        const refresh = get().refreshToken;
        // The refresh token is sufficient proof for the server to revoke
        // itself. Drop local identity and PHI before any network wait.
        get().clearAuth();
        if (refresh) {
          try {
            await authApi.logout(refresh);
          } catch {
            // Local auth state must clear even if the server token is already invalid.
          }
        }
      },
      async loadMe() {
        if (!get().accessToken) {
          set({ authStatus: "anonymous" });
          return null;
        }
        const startingRevision = authSessionRevision;
        const startingRefreshToken = get().refreshToken;
        try {
          const user = await authApi.me();
          if (
            startingRevision !== authSessionRevision
            || startingRefreshToken !== get().refreshToken
          ) {
            return get().user;
          }
          const currentUser = get().user;
          if (currentUser?.id !== user.id || currentUser?.role !== user.role) {
            rotateAuthenticatedQueryClient();
            authSessionRevision += 1;
          }
          set({ ...deriveAuth(user, get().accessToken) });
          return user;
        } catch {
          if (
            startingRevision === authSessionRevision
            && startingRefreshToken === get().refreshToken
          ) {
            get().clearAuth();
            return null;
          }
          return get().user;
        }
      },
      async changePassword(payload) {
        const startingRevision = authSessionRevision;
        const startingRefreshToken = get().refreshToken;
        const startingUserId = get().user?.id;
        const response = await authApi.changePassword(payload);
        if (
          startingRevision !== authSessionRevision
          || startingRefreshToken !== get().refreshToken
          || startingUserId !== get().user?.id
        ) {
          throw new AuthSessionSupersededError();
        }
        authSessionRevision += 1;
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
        const startingRevision = authSessionRevision;
        const startingRefreshToken = get().refreshToken;
        const optimistic = { ...previous, ...preferences };
        set({ user: optimistic, role: optimistic.role });
        try {
          const user = await authApi.updatePreferences(preferences);
          if (
            startingRevision !== authSessionRevision
            || startingRefreshToken !== get().refreshToken
            || previous.id !== get().user?.id
          ) {
            throw new AuthSessionSupersededError();
          }
          set({ ...deriveAuth(user, get().accessToken) });
          return user;
        } catch (error) {
          if (
            startingRevision === authSessionRevision
            && startingRefreshToken === get().refreshToken
            && previous.id === get().user?.id
          ) {
            set({ user: previous, role: previous.role });
          }
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
        authSessionRevision += 1;
        rotateAuthenticatedQueryClient();
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
  getSessionRevision: () => authSessionRevision,
  setAccessToken: (token) => useAuthStore.getState().setTokens(token),
  clearAuth: () => useAuthStore.getState().clearAuth(),
});
