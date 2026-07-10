import { Navigate, createBrowserRouter } from "react-router-dom";

import { AuthGuard } from "../auth/AuthGuard";
import { PasswordChangeGuard } from "../auth/PasswordChangeGuard";
import { RoleGuard } from "../auth/RoleGuard";
import { useAuthStore } from "../auth/authStore";
import { AuthLayout } from "../layouts/AuthLayout";
import { WorkspaceLayout } from "../layouts/WorkspaceLayout";
import { AccessDeniedPage } from "../pages/AccessDeniedPage";
import { ChangePasswordPage } from "../pages/ChangePasswordPage";
import { LoginPage } from "../pages/LoginPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { PlaceholderPage } from "../pages/PlaceholderPage";
import { AdminDashboardPage } from "../pages/admin/AdminDashboardPage";
import { DoctorDashboardPage } from "../pages/doctor/DoctorDashboardPage";
import { StaffDashboardPage } from "../pages/staff/StaffDashboardPage";
import type { UserRole } from "../types/auth";
import { dashboardPathForRole } from "../utils/roles";

type PlaceholderRoute = {
  path: string;
  title: string;
  role: UserRole;
  plannedPhase?: string;
};

const adminRoutes: PlaceholderRoute[] = [
  { path: "users", title: "Users", role: "ADMIN", plannedPhase: "Phase 13J" },
  { path: "clinic-settings", title: "Clinic Settings", role: "ADMIN", plannedPhase: "Phase 13J" },
  { path: "doctors", title: "Doctors & Staff", role: "ADMIN", plannedPhase: "Phase 13J" },
  { path: "leave", title: "Schedules & Leave", role: "ADMIN", plannedPhase: "Phase 13J" },
  { path: "patients", title: "Patients", role: "ADMIN", plannedPhase: "Phase 13E" },
  { path: "appointments", title: "Appointments", role: "ADMIN", plannedPhase: "Phase 13F" },
  { path: "appointments/day", title: "Appointments Day View", role: "ADMIN", plannedPhase: "Phase 13F" },
  { path: "appointments/week", title: "Appointments Week View", role: "ADMIN", plannedPhase: "Phase 13F" },
  { path: "appointments/month", title: "Appointments Month View", role: "ADMIN", plannedPhase: "Phase 13F" },
  { path: "appointments/list", title: "Appointments List", role: "ADMIN", plannedPhase: "Phase 13F" },
  { path: "appointments/needs-reschedule", title: "Needs Reschedule", role: "ADMIN", plannedPhase: "Phase 13F" },
  { path: "billing", title: "Billing", role: "ADMIN", plannedPhase: "Phase 13I" },
  { path: "audit-logs", title: "Audit Logs", role: "ADMIN", plannedPhase: "Phase 13J" },
  { path: "profile", title: "Profile", role: "ADMIN", plannedPhase: "Phase 13C" },
];

const staffRoutes: PlaceholderRoute[] = [
  { path: "appointments", title: "Appointments", role: "STAFF", plannedPhase: "Phase 13F" },
  { path: "appointments/day", title: "Appointments Day View", role: "STAFF", plannedPhase: "Phase 13F" },
  { path: "appointments/week", title: "Appointments Week View", role: "STAFF", plannedPhase: "Phase 13F" },
  { path: "appointments/month", title: "Appointments Month View", role: "STAFF", plannedPhase: "Phase 13F" },
  { path: "appointments/list", title: "Appointments List", role: "STAFF", plannedPhase: "Phase 13F" },
  { path: "appointments/needs-reschedule", title: "Needs Reschedule", role: "STAFF", plannedPhase: "Phase 13F" },
  { path: "patients", title: "Patients", role: "STAFF", plannedPhase: "Phase 13E" },
  { path: "billing/handoffs", title: "Billing Handoffs", role: "STAFF", plannedPhase: "Phase 13I" },
  { path: "billing/invoices", title: "Invoices", role: "STAFF", plannedPhase: "Phase 13I" },
  { path: "billing/payments", title: "Payments", role: "STAFF", plannedPhase: "Phase 13I" },
  { path: "profile/schedule", title: "Schedules View", role: "STAFF", plannedPhase: "Phase 13J" },
  { path: "profile/leave", title: "Profile Leave", role: "STAFF", plannedPhase: "Phase 13J" },
  { path: "profile", title: "Profile", role: "STAFF", plannedPhase: "Phase 13C" },
];

const doctorRoutes: PlaceholderRoute[] = [
  { path: "appointments", title: "My Appointments", role: "DOCTOR", plannedPhase: "Phase 13F" },
  { path: "appointments/day", title: "Appointments Day View", role: "DOCTOR", plannedPhase: "Phase 13F" },
  { path: "appointments/week", title: "Appointments Week View", role: "DOCTOR", plannedPhase: "Phase 13F" },
  { path: "appointments/list", title: "Appointments List", role: "DOCTOR", plannedPhase: "Phase 13F" },
  { path: "appointments/needs-reschedule", title: "Needs Reschedule", role: "DOCTOR", plannedPhase: "Phase 13F" },
  { path: "visits/active", title: "Active Visit", role: "DOCTOR", plannedPhase: "Phase 13G" },
  { path: "patients", title: "Patients", role: "DOCTOR", plannedPhase: "Phase 13E" },
  { path: "xrays", title: "X-rays & AI", role: "DOCTOR", plannedPhase: "Phase 13H" },
  { path: "external-xrays", title: "External X-ray Workspace", role: "DOCTOR", plannedPhase: "Phase 13H" },
  { path: "profile/schedule", title: "Profile Schedule", role: "DOCTOR", plannedPhase: "Phase 13J" },
  { path: "profile/leave", title: "Profile Leave", role: "DOCTOR", plannedPhase: "Phase 13J" },
  { path: "billing/handoffs", title: "My Billing Handoffs", role: "DOCTOR", plannedPhase: "Phase 13I" },
  { path: "profile", title: "Profile", role: "DOCTOR", plannedPhase: "Phase 13C" },
];

function placeholderChildren(routes: PlaceholderRoute[]) {
  return routes.map((route) => ({
    path: route.path,
    element: <PlaceholderPage title={route.title} role={route.role} plannedPhase={route.plannedPhase} />,
  }));
}

function HomeRedirect() {
  const role = useAuthStore((state) => state.role);
  return <Navigate to={dashboardPathForRole(role)} replace />;
}

export const router = createBrowserRouter([
  {
    path: "*",
    element: <NotFoundPage />,
  },
  {
    path: "/login",
    element: (
      <AuthLayout>
        <LoginPage />
      </AuthLayout>
    ),
  },
  {
    element: <AuthGuard />,
    children: [
      {
        element: <PasswordChangeGuard />,
        children: [
          {
            path: "/change-password",
            element: (
              <AuthLayout>
                <ChangePasswordPage />
              </AuthLayout>
            ),
          },
          { path: "/", element: <HomeRedirect /> },
          {
            path: "/access-denied",
            element: <AccessDeniedPage />,
          },
          {
            path: "/admin",
            element: (
              <RoleGuard roles={["ADMIN"]}>
                <WorkspaceLayout role="ADMIN" />
              </RoleGuard>
            ),
            children: [
              { index: true, element: <Navigate to="/admin/dashboard" replace /> },
              { path: "dashboard", element: <AdminDashboardPage /> },
              ...placeholderChildren(adminRoutes),
            ],
          },
          {
            path: "/staff",
            element: (
              <RoleGuard roles={["STAFF"]}>
                <WorkspaceLayout role="STAFF" />
              </RoleGuard>
            ),
            children: [
              { index: true, element: <Navigate to="/staff/dashboard" replace /> },
              { path: "dashboard", element: <StaffDashboardPage /> },
              ...placeholderChildren(staffRoutes),
            ],
          },
          {
            path: "/doctor",
            element: (
              <RoleGuard roles={["DOCTOR"]}>
                <WorkspaceLayout role="DOCTOR" />
              </RoleGuard>
            ),
            children: [
              { index: true, element: <Navigate to="/doctor/dashboard" replace /> },
              { path: "dashboard", element: <DoctorDashboardPage /> },
              ...placeholderChildren(doctorRoutes),
            ],
          },
        ],
      },
    ],
  },
]);
