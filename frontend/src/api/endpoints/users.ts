import type { Page, QueryParams } from "../../types/api";
import type { ResetPasswordPayload, UserCreatePayload, UserManagementRecord, UserUpdatePayload } from "../../types/users";
import { api } from "../http";
import { getAllPages } from "../pagination";

export const usersApi = {
  list: (query?: QueryParams) => api.get<Page<UserManagementRecord>>("/users/", query),
  listAll: (query?: QueryParams) => getAllPages((page) => api.get<Page<UserManagementRecord>>("/users/", { ...(query ?? {}), page })),
  listScheduleEmployees: async () => {
    const [doctors, staff] = await Promise.all([
      getAllPages((page) => api.get<Page<UserManagementRecord>>("/users/", { role: "DOCTOR", is_active: "true", page })),
      getAllPages((page) => api.get<Page<UserManagementRecord>>("/users/", { role: "STAFF", is_active: "true", page })),
    ]);
    return { count: doctors.count + staff.count, next: null, previous: null, results: [...doctors.results, ...staff.results] };
  },
  create: (payload: UserCreatePayload) => api.post<UserManagementRecord, UserCreatePayload>("/users/", payload),
  detail: (id: number) => api.get<UserManagementRecord>(`/users/${id}/`),
  update: (id: number, payload: UserUpdatePayload) => api.patch<UserManagementRecord, UserUpdatePayload>(`/users/${id}/`, payload),
  resetPassword: (id: number, payload: ResetPasswordPayload) =>
    api.post<UserManagementRecord, ResetPasswordPayload>(`/users/${id}/reset-password/`, payload),
  deactivate: (id: number) => api.post<UserManagementRecord>(`/users/${id}/deactivate/`),
  reactivate: (id: number) => api.post<UserManagementRecord>(`/users/${id}/reactivate/`),
};
