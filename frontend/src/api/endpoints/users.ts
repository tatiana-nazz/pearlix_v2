import type { Page, QueryParams } from "../../types/api";
import type { ResetPasswordPayload, UserCreatePayload, UserManagementRecord, UserUpdatePayload } from "../../types/users";
import { api } from "../http";

export const usersApi = {
  list: (query?: QueryParams) => api.get<Page<UserManagementRecord>>("/users/", query),
  create: (payload: UserCreatePayload) => api.post<UserManagementRecord, UserCreatePayload>("/users/", payload),
  detail: (id: number) => api.get<UserManagementRecord>(`/users/${id}/`),
  update: (id: number, payload: UserUpdatePayload) => api.patch<UserManagementRecord, UserUpdatePayload>(`/users/${id}/`, payload),
  resetPassword: (id: number, payload: ResetPasswordPayload) =>
    api.post<UserManagementRecord, ResetPasswordPayload>(`/users/${id}/reset-password/`, payload),
  deactivate: (id: number) => api.post<UserManagementRecord>(`/users/${id}/deactivate/`),
};
