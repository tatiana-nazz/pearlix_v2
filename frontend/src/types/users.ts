import type { AuthUser, UserRole } from "./auth";

export interface UserManagementRecord extends AuthUser {
  created_at: string;
  updated_at: string;
}

export interface UserCreatePayload {
  email: string;
  full_name: string;
  role: UserRole;
  password?: string;
  temporary_password?: string;
  is_active?: boolean;
}

export type UserUpdatePayload = Partial<UserCreatePayload>;

export interface ResetPasswordPayload {
  temporary_password: string;
}
