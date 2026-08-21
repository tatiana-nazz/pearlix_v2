export type UserRole = "ADMIN" | "STAFF" | "DOCTOR";
export type ThemePreference = "LIGHT" | "DARK" | "SYSTEM";
export type LanguagePreference = "EN" | "AR";

export interface UserSummary {
  id: number;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  theme_preference: ThemePreference;
  language_preference: LanguagePreference;
}

export interface AuthUser extends UserSummary {
  must_change_password: boolean;
  password_changed_at: string | null;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResponse {
  access: string;
  refresh: string;
  user: AuthUser;
}

export interface RefreshResponse {
  access: string;
}

export interface ChangePasswordPayload {
  current_password: string;
  new_password: string;
}

export type ChangePasswordResponse = LoginResponse;

export interface PreferencesPayload {
  theme_preference?: ThemePreference;
  language_preference?: LanguagePreference;
}

export type AuthStatus = "unknown" | "authenticated" | "anonymous" | "restoration_error";
