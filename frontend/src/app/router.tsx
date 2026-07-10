import { Navigate, Outlet, createBrowserRouter } from "react-router-dom";

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
};

const adminRoutes: PlaceholderRoute[] = [
  { path: "users", title: "Users", role: "ADMIN" },
  { path: "clinic-settings", title: "Clinic settings", role: "ADMIN" },
  { path: "doctors", title: "Doctors", role: "ADMIN" },
  { path: "leave", title: "Leave management", role: "ADMIN" },
  { path: "patients", title: "Patients", role: "ADMIN" },
  { path: "appointments", title: "Appointments", role: "ADMIN" },
  { path: "appointments/day", title: "Appointments day view", role: "ADMIN" },
  { path: "appointments/week", title: "Appointments week view", role: "ADMIN" },
  { path: "appointments/month", title: "Appointments month view", role: "ADMIN" },
  { path: "appointments/list", title: "Appointments list", role: "ADMIN" },
  { path: "appointments/needs-reschedule", title: "Needs reschedule", role: "ADMIN" },
  { path: "audit-logs", title: "Audit logs", role: "ADMIN" },
];

const staffRoutes: PlaceholderRoute[] = [
  { path: "patients", title: "Patients", role: "STAFF" },
  { path: "appointments", title: "Appointments", role: "STAFF" },
  { path: "appointments/day", title: "Appointments day view", role: "STAFF" },
  { path: "appointments/week", title: "Appointments week view", role: "STAFF" },
  { path: "appointments/month", title: "Appointments month view", role: "STAFF" },
  { path: "appointments/list", title: "Appointments list", role: "STAFF" },
  { path: "appointments/needs-reschedule", title: "Needs reschedule", role: "STAFF" },
  { path: "billing/handoffs", title: "Billing handoffs", role: "STAFF" },
  { path: "billing/invoices", title: "Invoices", role: "STAFF" },
  { path: "profile/schedule", title: "My schedule", role: "STAFF" },
  { path: "profile/leave", title: "My leave", role: "STAFF" },
];

const doctorRoutes: PlaceholderRoute[] = [
  { path: "appointments", title: "Appointments", role: "DOCTOR" },
  { path: "appointments/day", title: "Appointments day view", role: "DOCTOR" },
  { path: "appointments/week", title: "Appointments week view", role: "DOCTOR" },
  { path: "appointments/list", title: "Appointments list", role: "DOCTOR" },
  { path: "appointments/needs-reschedule", title: "Needs reschedule", role: "DOCTOR" },
  { path: "visits/active", title: "Active visit", role: "DOCTOR" },
  { path: "patients", title: "Patients", role: "DOCTOR" },
  { path: "external-xrays", title: "External X-rays", role: "DOCTOR" },
  { path: "profile/schedule", title: "My schedule", role: "DOCTOR" },
  { path: "profile/leave", title: "My leave", role: "DOCTOR" },
  { path: "billing/handoffs", title: "Billing handoffs", role: "DOCTOR" },
];

function placeholderChildren(routes: PlaceholderRoute[]) {
  return routes.map((route) => ({
    path: route.path,
    element: <PlaceholderPage title={route.title} role={route.role} />,
  }));
}

function HomeRedirect() {
  const role = useAuthStore((state) => state.role);
  return <Navigate to={dashboardPathForRole(role)} replace />;
}

export const router = createBrowserRouter([
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
          {
            element: <Outlet />,
            children: [{ path: "*", element: <NotFoundPage /> }],
          },
        ],
      },
    ],
  },
]);
