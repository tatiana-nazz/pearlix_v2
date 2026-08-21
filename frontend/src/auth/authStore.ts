import { create } from "zustand";
import { persist } from "zustand/middleware";

import { authApi } from "../api/endpoints/auth";
import { configureAuthAccessors } from "../api/http";
import { rotateAuthenticatedQueryClient } from "../app/queryClient";
import { toApiClientError } from "../api/errors";
import type { AuthStatus, AuthUser, ChangePasswordPayload, LanguagePreference, LoginPayload, ThemePreference, UserRole } from "../types/auth";
import {
  getAuthSessionId,
  publishAuthSessionEvent,
  subscribeToAuthSessionEvents,
  type AuthSessionEvent,
} from "./authSessionSync";

let authSessionRevision = 0;
let latestLoginRequest = 0;
const AUTH_STORAGE_KEY = "pearlix-auth";

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
  restorationError: string | null;
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
      restorationError: null,
      async login(payload) {
        const loginRequest = ++latestLoginRequest;
        const startingRevision = authSessionRevision;
        const previousUser = get().user;
        const previousAuthSessionId = getAuthSessionId(get().accessToken, get().refreshToken);
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
          restorationError: null,
        });
        if (previousUser && (
          previousUser.id !== response.user.id
          || previousUser.role !== response.user.role
        )) {
          publishAuthSessionEvent("IDENTITY_CHANGED", previousAuthSessionId);
        }
        return response.user;
      },
      async logout() {
        const refresh = get().refreshToken;
        const authSessionId = getAuthSessionId(get().accessToken, refresh);
        // The refresh token is sufficient proof for the server to revoke
        // itself. Drop local identity and PHI before any network wait.
        get().clearAuth();
        publishAuthSessionEvent("LOGOUT", authSessionId);
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
            const previousAuthSessionId = getAuthSessionId(get().accessToken, get().refreshToken);
            rotateAuthenticatedQueryClient();
            authSessionRevision += 1;
            if (currentUser) {
              publishAuthSessionEvent("IDENTITY_CHANGED", previousAuthSessionId);
            }
          }
          set({ ...deriveAuth(user, get().accessToken) });
          return user;
        } catch (error) {
          if (
            startingRevision === authSessionRevision
            && startingRefreshToken === get().refreshToken
          ) {
            const apiError = toApiClientError(error);
            if (apiError.status === 401 || apiError.status === 403) {
              get().clearAuth();
            } else {
              set({ authStatus: "restoration_error", restorationError: apiError.message });
            }
            return null;
          }
          return get().user;
        }
      },
      async changePassword(payload) {
        const startingRevision = authSessionRevision;
        const startingRefreshToken = get().refreshToken;
        const startingUserId = get().user?.id;
        const startingAuthSessionId = getAuthSessionId(get().accessToken, startingRefreshToken);
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
        publishAuthSessionEvent("IDENTITY_CHANGED", startingAuthSessionId);
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
          restorationError: null,
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
  clearAuth: (reason) => {
    const state = useAuthStore.getState();
    const authSessionId = getAuthSessionId(state.accessToken, state.refreshToken);
    state.clearAuth();
    if (reason === "SESSION_REVOKED") {
      publishAuthSessionEvent(reason, authSessionId);
    }
  },
});

function eventTargetsCurrentAuth(event: AuthSessionEvent) {
  const state = useAuthStore.getState();
  const authSessionId = getAuthSessionId(state.accessToken, state.refreshToken);
  return Boolean(
    event.authSessionId === authSessionId,
  );
}

function persistedReplacementSnapshot(event: AuthSessionEvent) {
  if (event.type !== "IDENTITY_CHANGED" || typeof window === "undefined") return null;
  try {
    const snapshot = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!snapshot) return null;
    const persisted = JSON.parse(snapshot) as {
      state?: { accessToken?: unknown; refreshToken?: unknown };
    };
    const persistedSessionId = getAuthSessionId(
      typeof persisted.state?.accessToken === "string" ? persisted.state.accessToken : null,
      typeof persisted.state?.refreshToken === "string" ? persisted.state.refreshToken : null,
    );
    return persistedSessionId && persistedSessionId !== event.authSessionId ? snapshot : null;
  } catch {
    return null;
  }
}

subscribeToAuthSessionEvents((event) => {
  if (!eventTargetsCurrentAuth(event)) return;
  const replacementSnapshot = persistedReplacementSnapshot(event);
  // This local-only clear increments the request revision and rotates the
  // QueryClient. It deliberately does not publish another event.
  useAuthStore.getState().clearAuth();
  if (replacementSnapshot) {
    try {
      window.localStorage.setItem(AUTH_STORAGE_KEY, replacementSnapshot);
    } catch {
      // The receiving tab remains safely anonymous if storage is unavailable.
    }
  }
});
