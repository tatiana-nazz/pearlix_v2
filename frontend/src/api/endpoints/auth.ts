import type {
  AuthUser,
  ChangePasswordPayload,
  ChangePasswordResponse,
  LoginPayload,
  LoginResponse,
  PreferencesPayload,
  RefreshResponse,
} from "../../types/auth";
import { api } from "../http";

export const authApi = {
  login: (payload: LoginPayload) => api.post<LoginResponse, LoginPayload>("/auth/login/", payload),
  refresh: (refresh: string) => api.post<RefreshResponse, { refresh: string }>("/auth/refresh/", { refresh }),
  logout: (refresh: string) => api.post<void, { refresh: string }>("/auth/logout/", { refresh }),
  me: () => api.get<AuthUser>("/me/"),
  changePassword: (payload: ChangePasswordPayload) =>
    api.post<ChangePasswordResponse, ChangePasswordPayload>("/auth/change-password/", payload),
  updatePreferences: (payload: PreferencesPayload) => api.patch<AuthUser, PreferencesPayload>("/me/preferences/", payload),
};
