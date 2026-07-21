import { Navigate, createBrowserRouter, useParams } from "react-router-dom";

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
import { AdminDashboardPage } from "../pages/admin/AdminDashboardPage";
import { AdminTeamDetailPage, AdminTeamListPage, StaffTeamDetailPage, StaffTeamListPage } from "../pages/admin/TeamPages";
import { ScheduleManagementPage } from "../pages/admin/ScheduleManagementPage";
import { LeaveManagementPage } from "../pages/admin/LeaveManagementPage";
import { AppointmentsPage } from "../pages/appointments/AppointmentsPage";
import { RescheduleAppointmentPage } from "../pages/appointments/RescheduleAppointmentPage";
import { DoctorDashboardPage } from "../pages/doctor/DoctorDashboardPage";
import { NewPatientPage } from "../pages/patients/NewPatientPage";
import { PatientProfilePage } from "../pages/patients/PatientProfilePage";
import { PatientsPage } from "../pages/patients/PatientsPage";
import { StaffDashboardPage } from "../pages/staff/StaffDashboardPage";
import { OwnProfilePage } from "../pages/profile/OwnProfilePage";
import { DoctorActiveVisitPage } from "../pages/visits/DoctorActiveVisitPage";
import { VisitDetailPage } from "../pages/visits/VisitDetailPage";
import { ExternalXrayDetailPage } from "../pages/xrays/ExternalXrayPages";
import { XrayDetailPage } from "../pages/xrays/XrayDetailPage";
import { XrayWorkspacePage } from "../pages/xrays/XrayWorkspacePage";
import { AdminAuditLogDetailPage, AdminAuditLogListPage, AdminClinicSettingsPage, AdminNewUserPage, AdminUserDetailPage, AdminUserListPage } from "../pages/admin/AdminManagementPages";
import { BillingHandoffDetailPage, BillingHandoffListPage, BillingWorkspacePage, InvoiceDetailPage, InvoiceListPage, InvoicePrintPage, NewInvoicePage } from "../pages/billing/BillingPages";
import type { UserRole } from "../types/auth";
import { dashboardPathForRole } from "../utils/roles";

function HomeRedirect() {
  const role = useAuthStore((state) => state.role);
  return <Navigate to={dashboardPathForRole(role)} replace />;
}

function ExternalCaseRedirect({ role }: { role: "admin" | "doctor" }) {
  const { caseId } = useParams();
  return <Navigate to={`/${role}/xrays/cases/${caseId ?? ""}`} replace />;
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
              { path: "profile", element: <OwnProfilePage /> },
              { path: "team", element: <AdminTeamListPage /> },
              { path: "team/:memberId", element: <AdminTeamDetailPage /> },
              { path: "doctors", element: <ScheduleManagementPage /> },
              { path: "leave", element: <LeaveManagementPage /> },
              { path: "leave/:exceptionId", element: <LeaveManagementPage /> },
              { path: "appointments", element: <Navigate to="/admin/appointments/day" replace /> },
              { path: "appointments/day", element: <AppointmentsPage role="ADMIN" view="day" /> },
              { path: "appointments/week", element: <AppointmentsPage role="ADMIN" view="week" /> },
              { path: "appointments/month", element: <AppointmentsPage role="ADMIN" view="month" /> },
              { path: "appointments/list", element: <AppointmentsPage role="ADMIN" view="list" /> },
              { path: "appointments/needs-reschedule", element: <AppointmentsPage role="ADMIN" view="needs-reschedule" /> },
              { path: "patients", element: <PatientsPage role="ADMIN" /> },
              { path: "patients/:patientId", element: <PatientProfilePage role="ADMIN" /> },
              { path: "visits/:visitId", element: <VisitDetailPage role="ADMIN" /> },
              { path: "xrays", element: <XrayWorkspacePage role="ADMIN" /> },
              { path: "xrays/:xrayId", element: <XrayDetailPage role="ADMIN" /> },
              { path: "xrays/cases/:caseId", element: <ExternalXrayDetailPage role="ADMIN" /> },
              { path: "external-xrays", element: <Navigate to="/admin/xrays?tab=unassigned" replace /> },
              { path: "external-xrays/:caseId", element: <ExternalCaseRedirect role="admin" /> },
              { path: "users", element: <AdminUserListPage /> },
              { path: "users/new", element: <AdminNewUserPage /> },
              { path: "users/:userId", element: <AdminUserDetailPage /> },
              { path: "clinic-settings", element: <AdminClinicSettingsPage /> },
              { path: "audit-logs", element: <AdminAuditLogListPage /> },
              { path: "audit-logs/:auditLogId", element: <AdminAuditLogDetailPage /> },
              { path: "billing", element: <BillingWorkspacePage role="ADMIN" /> },
              { path: "billing/handoffs", element: <Navigate to="/admin/billing" replace /> },
              { path: "billing/handoffs/:handoffId", element: <BillingHandoffDetailPage role="ADMIN" /> },
              { path: "billing/invoices", element: <Navigate to="/admin/billing" replace /> },
              { path: "billing/invoices/:invoiceId", element: <InvoiceDetailPage role="ADMIN" /> },
              { path: "billing/invoices/:invoiceId/print", element: <InvoicePrintPage role="ADMIN" /> },
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
              { path: "team", element: <StaffTeamListPage /> },
              { path: "team/:memberId", element: <StaffTeamDetailPage /> },
              { path: "profile", element: <OwnProfilePage /> },
              { path: "profile/schedule", element: <Navigate to="/staff/profile?tab=schedule" replace /> },
              { path: "profile/leave", element: <Navigate to="/staff/profile?tab=leave" replace /> },
              { path: "appointments", element: <Navigate to="/staff/appointments/day" replace /> },
              { path: "appointments/day", element: <AppointmentsPage role="STAFF" view="day" /> },
              { path: "appointments/week", element: <AppointmentsPage role="STAFF" view="week" /> },
              { path: "appointments/month", element: <AppointmentsPage role="STAFF" view="month" /> },
              { path: "appointments/list", element: <AppointmentsPage role="STAFF" view="list" /> },
              { path: "appointments/needs-reschedule", element: <AppointmentsPage role="STAFF" view="needs-reschedule" /> },
              { path: "appointments/:appointmentId/reschedule", element: <RescheduleAppointmentPage /> },
              { path: "patients", element: <PatientsPage role="STAFF" /> },
              { path: "patients/new", element: <NewPatientPage role="STAFF" /> },
              { path: "patients/:patientId", element: <PatientProfilePage role="STAFF" /> },
              { path: "visits/:visitId", element: <VisitDetailPage role="STAFF" /> },
              { path: "xrays", element: <XrayWorkspacePage role="STAFF" /> },
              { path: "xrays/:xrayId", element: <XrayDetailPage role="STAFF" /> },
              { path: "billing", element: <BillingWorkspacePage role="STAFF" /> },
              { path: "billing/handoffs", element: <Navigate to="/staff/billing" replace /> },
              { path: "billing/handoffs/:handoffId", element: <BillingHandoffDetailPage role="STAFF" /> },
              { path: "billing/invoices", element: <Navigate to="/staff/billing" replace /> },
              { path: "billing/invoices/new", element: <Navigate to="/staff/billing" replace /> },
              { path: "billing/invoices/:invoiceId", element: <InvoiceDetailPage role="STAFF" /> },
              { path: "billing/invoices/:invoiceId/payments", element: <InvoiceDetailPage role="STAFF" /> },
              { path: "billing/invoices/:invoiceId/print", element: <InvoicePrintPage role="STAFF" /> },
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
              { path: "profile", element: <OwnProfilePage /> },
              { path: "profile/schedule", element: <Navigate to="/doctor/profile?tab=schedule" replace /> },
              { path: "profile/leave", element: <Navigate to="/doctor/profile?tab=leave" replace /> },
              { path: "appointments", element: <Navigate to="/doctor/appointments/day" replace /> },
              { path: "appointments/day", element: <AppointmentsPage role="DOCTOR" view="day" /> },
              { path: "appointments/week", element: <AppointmentsPage role="DOCTOR" view="week" /> },
              { path: "appointments/list", element: <AppointmentsPage role="DOCTOR" view="list" /> },
              { path: "appointments/needs-reschedule", element: <AppointmentsPage role="DOCTOR" view="needs-reschedule" /> },
              { path: "appointments/:appointmentId/reschedule", element: <Navigate to="/access-denied" replace /> },
              { path: "patients", element: <PatientsPage role="DOCTOR" /> },
              { path: "patients/:patientId", element: <PatientProfilePage role="DOCTOR" /> },
              { path: "patients/:patientId/clinical-history", element: <PatientProfilePage role="DOCTOR" defaultTab="visits" /> },
              { path: "visits/active", element: <DoctorActiveVisitPage /> },
              { path: "visits/:visitId", element: <VisitDetailPage role="DOCTOR" /> },
              { path: "xrays", element: <XrayWorkspacePage role="DOCTOR" /> },
              { path: "xrays/:xrayId", element: <XrayDetailPage role="DOCTOR" /> },
              { path: "xrays/cases/:caseId", element: <ExternalXrayDetailPage role="DOCTOR" /> },
              { path: "external-xrays", element: <Navigate to="/doctor/xrays?tab=unassigned" replace /> },
              { path: "external-xrays/:caseId", element: <ExternalCaseRedirect role="doctor" /> },
              { path: "billing/handoffs", element: <Navigate to="/doctor/dashboard" replace /> },
              { path: "billing/handoffs/:handoffId", element: <Navigate to="/doctor/dashboard" replace /> },
            ],
          },
        ],
      },
    ],
  },
]);
