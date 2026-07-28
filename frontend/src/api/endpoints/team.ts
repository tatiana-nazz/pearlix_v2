import type { Page, QueryParams } from "../../types/api";
import type { AdminTeamMemberDetail, AdminTeamMemberSummary, RoleTransitionConfirmPayload, RoleTransitionPreview, ProfessionalStatusPayload, StaffTeamMemberDetail, TeamMemberCreatePayload, TeamMemberDetail, TeamMemberSummary, TeamMemberUpdatePayload } from "../../types/team";
import type { UserManagementRecord } from "../../types/users";
import { api } from "../http";

export const teamQueryKeys = {
  all: ["team-members"] as const,
  detail: (id: number) => ["team-members", id] as const,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

export function normalizeScheduleSummary(value: unknown) {
  const summary = isRecord(value) ? value : null;
  const hasActiveSchedule = summary?.has_active_schedule === true;
  const count = summary?.active_shift_count;
  const activeShiftCount = typeof count === "number" && Number.isFinite(count) && count >= 0 ? count : 0;
  return { has_active_schedule: hasActiveSchedule, active_shift_count: activeShiftCount };
}

export function normalizeTeamMember<T extends TeamMemberSummary>(member: T) {
  return { ...member, schedule_summary: normalizeScheduleSummary(member.schedule_summary) };
}

export const teamApi = {
  list: (query?: QueryParams) => api.get<Page<TeamMemberSummary>>("/team-members/", query).then((page) => ({ ...page, results: page.results.map(normalizeTeamMember) })),
  create: (payload: TeamMemberCreatePayload) => api.post<AdminTeamMemberSummary, TeamMemberCreatePayload>("/team-members/", payload),
  detail: (id: number) => api.get<AdminTeamMemberDetail>(`/team-members/${id}/`).then(normalizeTeamMember),
  staffDetail: (id: number) => api.get<StaffTeamMemberDetail>(`/team-members/${id}/`).then(normalizeTeamMember),
  update: (id: number, payload: TeamMemberUpdatePayload) => api.patch<AdminTeamMemberSummary, TeamMemberUpdatePayload>(`/team-members/${id}/`, payload),
  setProfessionalStatus: (id: number, payload: ProfessionalStatusPayload) => api.post<AdminTeamMemberSummary, ProfessionalStatusPayload>(`/team-members/${id}/set-professional-status/`, payload),
  previewRoleTransition: (id: number, target_role: RoleTransitionPreview["target_role"]) => api.post<RoleTransitionPreview>(`/users/${id}/transition-role/`, { target_role, mode: "PREVIEW" }),
  confirmRoleTransition: (id: number, payload: RoleTransitionConfirmPayload) => api.post<UserManagementRecord, RoleTransitionConfirmPayload>(`/users/${id}/transition-role/`, payload),
  reactivateUser: (id: number) => api.post<UserManagementRecord>(`/users/${id}/reactivate/`),
};
