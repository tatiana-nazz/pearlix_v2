import type { UserRole } from "../types/auth";

export function dashboardPathForRole(role: UserRole | null | undefined): string {
  if (role === "ADMIN") return "/admin/dashboard";
  if (role === "STAFF") return "/staff/dashboard";
  if (role === "DOCTOR") return "/doctor/dashboard";
  return "/login";
}

export function roleLabel(role: UserRole | null | undefined): string {
  if (role === "ADMIN") return "Admin";
  if (role === "STAFF") return "Staff";
  if (role === "DOCTOR") return "Doctor";
  return "User";
}
