import type { AdminDashboardResponse, DoctorDashboardResponse, StaffDashboardResponse } from "../../types/dashboard";
import { api } from "../http";

export const dashboardApi = {
  admin: () => api.get<AdminDashboardResponse>("/dashboard/admin/"),
  staff: () => api.get<StaffDashboardResponse>("/dashboard/staff/"),
  doctor: () => api.get<DoctorDashboardResponse>("/dashboard/doctor/"),
};
