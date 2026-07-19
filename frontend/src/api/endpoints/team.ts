import type { Page, QueryParams } from "../../types/api";
import type { AdminTeamMemberDetail, AdminTeamMemberSummary, RoleTransitionConfirmPayload, RoleTransitionPreview, ProfessionalStatusPayload, StaffTeamMemberDetail, TeamMemberCreatePayload, TeamMemberDetail, TeamMemberSummary, TeamMemberUpdatePayload } from "../../types/team";
import type { UserManagementRecord } from "../../types/users";
import { api } from "../http";

export const teamQueryKeys = {
  all: ["team-members"] as const,
  detail: (id: number) => ["team-members", id] as const,
};

export const teamApi = {
  list: (query?: QueryParams) => api.get<Page<TeamMemberSummary>>("/team-members/", query),
  create: (payload: TeamMemberCreatePayload) => api.post<AdminTeamMemberSummary, TeamMemberCreatePayload>("/team-members/", payload),
  detail: (id: number) => api.get<AdminTeamMemberDetail>(`/team-members/${id}/`),
  staffDetail: (id: number) => api.get<StaffTeamMemberDetail>(`/team-members/${id}/`),
  update: (id: number, payload: TeamMemberUpdatePayload) => api.patch<AdminTeamMemberSummary, TeamMemberUpdatePayload>(`/team-members/${id}/`, payload),
  setProfessionalStatus: (id: number, payload: ProfessionalStatusPayload) => api.post<AdminTeamMemberSummary, ProfessionalStatusPayload>(`/team-members/${id}/set-professional-status/`, payload),
  previewRoleTransition: (id: number, target_role: RoleTransitionPreview["target_role"]) => api.post<RoleTransitionPreview>(`/users/${id}/transition-role/`, { target_role, mode: "PREVIEW" }),
  confirmRoleTransition: (id: number, payload: RoleTransitionConfirmPayload) => api.post<UserManagementRecord, RoleTransitionConfirmPayload>(`/users/${id}/transition-role/`, payload),
  reactivateUser: (id: number) => api.post<UserManagementRecord>(`/users/${id}/reactivate/`),
};
