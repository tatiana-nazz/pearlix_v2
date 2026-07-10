import type { AdminDashboardResponse, DoctorDashboardResponse, StaffDashboardResponse } from "../../types/dashboard";
import { api } from "../http";

export function getAdminDashboard() {
  return api.get<AdminDashboardResponse>("/dashboard/admin/");
}

export function getStaffDashboard() {
  return api.get<StaffDashboardResponse>("/dashboard/staff/");
}

export function getDoctorDashboard() {
  return api.get<DoctorDashboardResponse>("/dashboard/doctor/");
}

export const dashboardApi = {
  admin: getAdminDashboard,
  staff: getStaffDashboard,
  doctor: getDoctorDashboard,
};
