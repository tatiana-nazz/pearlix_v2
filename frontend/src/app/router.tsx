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
import { AdminDashboardPage } from "../pages/admin/AdminDashboardPage";
import { TeamDetailPage, TeamListPage, TeamNewPage } from "../pages/admin/team/TeamPages";
import { ScheduleManagementPage } from "../pages/admin/ScheduleManagementPage";
import { LeaveManagementPage } from "../pages/admin/LeaveManagementPage";
import { AppointmentsPage } from "../pages/appointments/AppointmentsPage";
import { RescheduleAppointmentPage } from "../pages/appointments/RescheduleAppointmentPage";
import { DoctorDashboardPage } from "../pages/doctor/DoctorDashboardPage";
import { NewPatientPage } from "../pages/patients/NewPatientPage";
import { PatientProfilePage } from "../pages/patients/PatientProfilePage";
import { PatientsPage } from "../pages/patients/PatientsPage";
import { StaffDashboardPage } from "../pages/staff/StaffDashboardPage";
import { OwnSchedulePage } from "../pages/profile/OwnSchedulePage";
import { OwnLeavePage } from "../pages/profile/OwnLeavePage";
import { DoctorActiveVisitPage } from "../pages/visits/DoctorActiveVisitPage";
import { VisitDetailPage } from "../pages/visits/VisitDetailPage";
import { ExternalXrayDetailPage, ExternalXrayListPage } from "../pages/xrays/ExternalXrayPages";
import { XrayDetailPage } from "../pages/xrays/XrayDetailPage";
import { XrayListPage } from "../pages/xrays/XrayListPage";
import { AdminAuditLogDetailPage, AdminAuditLogListPage, AdminClinicSettingsPage } from "../pages/admin/AdminManagementPages";
import { AdminNewUserPage, AdminUserDetailPage, AdminUserListPage } from "../pages/admin/users/UserPages";
import { BillingHandoffDetailPage, BillingHandoffListPage, InvoiceDetailPage, InvoiceListPage, InvoicePrintPage, NewInvoicePage } from "../pages/billing/BillingPages";
import type { UserRole } from "../types/auth";
import { dashboardPathForRole } from "../utils/roles";

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
              { path: "xrays", element: <XrayListPage role="ADMIN" /> },
              { path: "xrays/:xrayId", element: <XrayDetailPage role="ADMIN" /> },
              { path: "external-xrays", element: <ExternalXrayListPage role="ADMIN" /> },
              { path: "external-xrays/:caseId", element: <ExternalXrayDetailPage role="ADMIN" /> },
              { path: "users", element: <AdminUserListPage /> },
              { path: "users/new", element: <AdminNewUserPage /> },
              { path: "users/:userId", element: <AdminUserDetailPage /> },
              { path: "team", element: <TeamListPage /> },
              { path: "team/new", element: <TeamNewPage /> },
              { path: "team/:teamMemberId", element: <TeamDetailPage /> },
              { path: "clinic-settings", element: <AdminClinicSettingsPage /> },
              { path: "audit-logs", element: <AdminAuditLogListPage /> },
              { path: "audit-logs/:auditLogId", element: <AdminAuditLogDetailPage /> },
              { path: "billing", element: <Navigate to="/admin/billing/handoffs" replace /> },
              { path: "billing/handoffs", element: <BillingHandoffListPage role="ADMIN" /> },
              { path: "billing/handoffs/:handoffId", element: <BillingHandoffDetailPage role="ADMIN" /> },
              { path: "billing/invoices", element: <InvoiceListPage role="ADMIN" /> },
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
              { path: "profile/schedule", element: <OwnSchedulePage /> },
              { path: "profile/leave", element: <OwnLeavePage /> },
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
              { path: "xrays", element: <XrayListPage role="STAFF" /> },
              { path: "xrays/:xrayId", element: <XrayDetailPage role="STAFF" /> },
              { path: "billing/handoffs", element: <BillingHandoffListPage role="STAFF" /> },
              { path: "billing/handoffs/:handoffId", element: <BillingHandoffDetailPage role="STAFF" /> },
              { path: "billing/invoices", element: <InvoiceListPage role="STAFF" /> },
              { path: "billing/invoices/new", element: <NewInvoicePage /> },
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
              { path: "profile/schedule", element: <OwnSchedulePage /> },
              { path: "profile/leave", element: <OwnLeavePage /> },
              { path: "appointments", element: <Navigate to="/doctor/appointments/day" replace /> },
              { path: "appointments/day", element: <AppointmentsPage role="DOCTOR" view="day" /> },
              { path: "appointments/week", element: <AppointmentsPage role="DOCTOR" view="week" /> },
              { path: "appointments/list", element: <AppointmentsPage role="DOCTOR" view="list" /> },
              { path: "appointments/needs-reschedule", element: <AppointmentsPage role="DOCTOR" view="needs-reschedule" /> },
              { path: "patients", element: <PatientsPage role="DOCTOR" /> },
              { path: "patients/:patientId", element: <PatientProfilePage role="DOCTOR" /> },
              { path: "patients/:patientId/clinical-history", element: <PatientProfilePage role="DOCTOR" defaultTab="visits" /> },
              { path: "visits/active", element: <DoctorActiveVisitPage /> },
              { path: "visits/:visitId", element: <VisitDetailPage role="DOCTOR" /> },
              { path: "xrays", element: <XrayListPage role="DOCTOR" /> },
              { path: "xrays/:xrayId", element: <XrayDetailPage role="DOCTOR" /> },
              { path: "external-xrays", element: <ExternalXrayListPage role="DOCTOR" /> },
              { path: "external-xrays/:caseId", element: <ExternalXrayDetailPage role="DOCTOR" /> },
              { path: "billing/handoffs", element: <BillingHandoffListPage role="DOCTOR" /> },
              { path: "billing/handoffs/:handoffId", element: <BillingHandoffDetailPage role="DOCTOR" /> },
            ],
          },
        ],
      },
    ],
  },
]);
