import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { billingApi } from "../../api/endpoints/billing";
import { dashboardApi } from "../../api/endpoints/dashboard";
import { useAuthStore } from "../../auth/authStore";
import type { InvoiceFinancialSummary } from "../../types/billing";
import type { AdminDashboardResponse, DashboardAppointmentSummary, DoctorDashboardResponse, StaffDashboardResponse } from "../../types/dashboard";
import { AdminDashboard } from "./AdminDashboard";
import { DoctorDashboard } from "./DoctorDashboard";
import { StaffDashboard } from "./StaffDashboard";

const appointment = (id: number, status: DashboardAppointmentSummary["status"] = "CHECKED_IN", hour = 9): DashboardAppointmentSummary => ({ id, patient: { id: id + 10, full_name: `Patient ${id}`, phone_number: "0911000000" }, doctor: { id: 3, full_name: "Dr Sami", email: "doctor@example.test", role: "DOCTOR" }, start_datetime: `2026-07-20T${String(hour).padStart(2, "0")}:00:00+03:00`, end_datetime: `2026-07-20T${String(hour).padStart(2, "0")}:30:00+03:00`, duration_minutes: 30, status, reason: `Reason ${id}` });

const invoice = { id: 12, invoice_number: "INV-2026-0012", patient: { id: 8, full_name: "Maya Hassan", phone_number: "0911000000" }, currency: "SYP" as const, total_amount: "120000.00", paid_amount: "20000.00", remaining_amount: "100000.00", status: "PARTIALLY_PAID" as const, created_at: "2026-07-20T08:00:00+03:00" };
const counts = { UPCOMING: 4, CHECKED_IN: 2, ACTIVE: 1, COMPLETED: 8, NEEDS_RESCHEDULE: 3, CANCELLED: 1, NO_SHOW: 0 };
const activity = [{ date: "2026-07-19", SYP: { invoiced: "100000.00", collected: "50000.00" }, USD: { invoiced: "25.00", collected: "10.00" } }, { date: "2026-07-20", SYP: { invoiced: "200000.00", collected: "100000.00" }, USD: { invoiced: "50.00", collected: "30.00" } }];
const adminData: AdminDashboardResponse = { clinic_date: "2026-07-20", clinic_timezone: "Asia/Damascus", today_appointments_count: 2, checked_in_appointments_count: 1, needs_reschedule_appointments_count: 3, active_visits_count: 2, open_invoices_count: 7, today_invoices_count: 4, today_appointments: [appointment(4), appointment(5, "UPCOMING", 10)], appointment_status_last_7_days: counts, billing_activity_last_30_days: activity, recent_invoices: [invoice] };
const staffData: StaffDashboardResponse = { clinic_date: "2026-07-20", clinic_timezone: "Asia/Damascus", today_appointments_count: 2, patients_ready_count: 1, needs_reschedule_count: 3, open_invoices_count: 4, today_appointments: [appointment(4), appointment(5, "UPCOMING", 10)], open_invoices: [invoice] };
const doctorData: DoctorDashboardResponse = { clinic_date: "2026-07-20", clinic_timezone: "Asia/Damascus", today_appointments_count: 3, patients_ready_count: 1, completed_today_count: 2, needs_reschedule_count: 1, today_appointments: [appointment(4), appointment(5, "UPCOMING", 10), appointment(6, "COMPLETED", 8)], own_active_visit: { id: 70, patient: appointment(4).patient, appointment_id: 4, appointment_reason: "Review", appointment_start_datetime: appointment(4).start_datetime, status: "ACTIVE", started_at: "2026-07-20T09:05:00+03:00", completed_at: null } };
const summary: InvoiceFinancialSummary = { clinic_date: "2026-07-20", clinic_timezone: "Asia/Damascus", invoice_count: 20, status_counts: { UNPAID: 5, PARTIALLY_PAID: 2, PAID: 12, CANCELLED: 1 }, open_invoice_count: 7, currency_totals: { SYP: { invoiced: "1", paid: "1", outstanding: "0" }, USD: { invoiced: "1", paid: "1", outstanding: "0" } }, payments_collected_in_period: { SYP: "1", USD: "1" } };

function renderDashboard(page: React.ReactNode) { const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); return render(<QueryClientProvider client={client}><MemoryRouter>{page}</MemoryRouter></QueryClientProvider>); }
function setUser(role: "ADMIN" | "STAFF" | "DOCTOR", language_preference: "EN" | "AR" = "EN") { useAuthStore.setState({ user: { id: 1, full_name: "Dashboard User", email: "user@example.test", role, is_active: true, must_change_password: false, password_changed_at: null, theme_preference: "LIGHT", language_preference } }); }
function mockAdmin(data = adminData, financialSummary = summary) { vi.spyOn(dashboardApi, "admin").mockResolvedValue(data); vi.spyOn(billingApi, "invoiceSummary").mockResolvedValue(financialSummary); }

describe("role dashboards", () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  it("renders five authoritative Admin KPIs with exact operational routes", async () => {
    setUser("ADMIN"); mockAdmin(); renderDashboard(<AdminDashboard />);
    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Today's appointments: 2" })).toHaveAttribute("href", "/admin/appointments/day?date=2026-07-20");
    expect(screen.getByText("Active visits").closest(".v2-card")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Needs reschedule: 3" })).toHaveAttribute("href", "/admin/appointments/needs-reschedule");
    expect(screen.getByRole("link", { name: "Open invoices: 7" })).toHaveAttribute("href", "/admin/billing/invoices?status=UNPAID");
    expect(screen.getByRole("link", { name: "Today's invoices: 4" })).toHaveAttribute("href", "/admin/billing/invoices?date_from=2026-07-20&date_to=2026-07-20");
    expect(document.querySelectorAll(".dashboard-v2-metrics .v2-card")).toHaveLength(5);
  });

  it("removes Admin management shortcuts and Quick actions", async () => {
    setUser("ADMIN"); mockAdmin(); renderDashboard(<AdminDashboard />); await screen.findByRole("heading", { name: "Dashboard" });
    expect(screen.queryByText("Quick actions", { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Add team member" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Create user" })).not.toBeInTheDocument();
  });

  it("renders only meaningful Admin attention items and a calm empty state", async () => {
    setUser("ADMIN"); mockAdmin(); const { unmount } = renderDashboard(<AdminDashboard />);
    const attention = await screen.findByRole("navigation", { name: "Dashboard attention items" });
    expect(within(attention).getAllByRole("link")).toHaveLength(3); unmount(); vi.restoreAllMocks();
    mockAdmin({ ...adminData, checked_in_appointments_count: 0, needs_reschedule_appointments_count: 0, open_invoices_count: 0 }, { ...summary, open_invoice_count: 0 });
    renderDashboard(<AdminDashboard />); expect(await screen.findByText("No urgent operational issues.")).toBeInTheDocument();
  });

  it("renders semantic appointment status and separate-currency billing charts", async () => {
    setUser("ADMIN"); mockAdmin(); renderDashboard(<AdminDashboard />); await screen.findByRole("heading", { name: "Appointments by status" });
    for (const status of ["UPCOMING", "CHECKED_IN", "ACTIVE", "COMPLETED", "NEEDS_RESCHEDULE", "CANCELLED", "NO_SHOW"]) expect(document.querySelector(`[data-status="${status}"]`)).toBeInTheDocument();
    expect(screen.getByLabelText(/Upcoming: 4.*No show: 0/)).toBeInTheDocument();
    expect(screen.getByLabelText(/SYP: Invoiced 300000.00, Collected 150000.00/)).toBeInTheDocument();
    expect(screen.getByLabelText(/USD: Invoiced 75.00, Collected 40.00/)).toBeInTheDocument();
    expect(screen.queryByText(/combined currency|mixed currency/i)).not.toBeInTheDocument();
  });

  it("opens exact Admin appointments and invoices and uses exact history routes", async () => {
    setUser("ADMIN"); mockAdmin(); renderDashboard(<AdminDashboard />); await screen.findByRole("heading", { name: "Today's appointments" });
    expect(screen.getByRole("link", { name: "Open appointment 4: Patient 4" })).toHaveAttribute("href", "/admin/appointments/4");
    expect(screen.getByRole("link", { name: "Invoice INV-2026-0012: Maya Hassan" })).toHaveAttribute("href", "/admin/billing/invoices/12");
    expect(screen.getByRole("link", { name: "View day" })).toHaveAttribute("href", "/admin/appointments/day?date=2026-07-20");
    expect(screen.getByRole("link", { name: "View invoice history" })).toHaveAttribute("href", "/admin/billing/invoices");
  });

  it("renders the Staff operational queue, exact KPIs, attention, and billing follow-up", async () => {
    setUser("STAFF"); vi.spyOn(dashboardApi, "staff").mockResolvedValue(staffData); renderDashboard(<StaffDashboard />);
    expect(await screen.findByRole("heading", { name: "Staff dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Today's appointments: 2" })).toHaveAttribute("href", "/staff/appointments/day?date=2026-07-20");
    expect(screen.getByRole("link", { name: "Patients ready: 1" })).toHaveAttribute("href", "/staff/appointments/day?date=2026-07-20&status=CHECKED_IN");
    expect(screen.getByRole("link", { name: "Needs reschedule: 3" })).toHaveAttribute("href", "/staff/appointments/needs-reschedule");
    expect(screen.getByRole("link", { name: "Open invoices: 4" })).toHaveAttribute("href", "/staff/billing/invoices");
    expect(screen.getByRole("link", { name: "Open appointment 4: Patient 4" })).toHaveAttribute("href", "/staff/appointments/4");
    expect(screen.getByRole("link", { name: "Invoice INV-2026-0012: Maya Hassan" })).toHaveAttribute("href", "/staff/billing/invoices/12");
    expect(screen.getByRole("link", { name: "View billing" })).toHaveAttribute("href", "/staff/billing/overview");
  });

  it("keeps only the two Staff header actions and has no Quick actions or charts", async () => {
    setUser("STAFF"); vi.spyOn(dashboardApi, "staff").mockResolvedValue(staffData); renderDashboard(<StaffDashboard />); await screen.findByRole("heading", { name: "Staff dashboard" });
    expect(screen.getByRole("link", { name: "New appointment" })).toHaveAttribute("href", "/staff/appointments/day");
    expect(screen.getByRole("link", { name: "New patient" })).toHaveAttribute("href", "/staff/patients/new");
    expect(screen.queryByText("Quick actions")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Billing activity" })).not.toBeInTheDocument();
  });

  it("renders an empty Staff queue and invoice follow-up without hiding the workspace", async () => {
    setUser("STAFF"); vi.spyOn(dashboardApi, "staff").mockResolvedValue({ ...staffData, today_appointments: [], open_invoices: [] }); renderDashboard(<StaffDashboard />);
    expect(await screen.findByText("No appointments scheduled today.")).toBeInTheDocument();
    expect(screen.getByText("No open invoices need follow-up.")).toBeInTheDocument();
  });

  it("renders Doctor clinical KPIs and an active visit without billing or shortcuts", async () => {
    setUser("DOCTOR"); vi.spyOn(dashboardApi, "doctor").mockResolvedValue(doctorData); renderDashboard(<DoctorDashboard />);
    expect(await screen.findByRole("heading", { name: "Doctor dashboard" })).toBeInTheDocument();
    for (const name of ["Today's appointments: 3", "Patients ready: 1", "Needs reschedule: 1"]) expect(screen.getByRole("link", { name })).toBeInTheDocument();
    expect(screen.getByText("Completed today").closest(".v2-card")).toHaveTextContent("2");
    expect(screen.getAllByRole("link", { name: "Continue visit" })[0]).toHaveAttribute("href", "/doctor/visits/active");
    expect(screen.getAllByText("Patient 4").length).toBeGreaterThan(0);
    expect(screen.queryByText("Quick actions")).not.toBeInTheDocument();
    expect(screen.queryByText("Billing activity")).not.toBeInTheDocument();
    expect(screen.queryByText("Open invoices")).not.toBeInTheDocument();
  });

  it("Doctor schedule rows navigate exactly and Next patient prefers checked-in", async () => {
    setUser("DOCTOR"); vi.spyOn(dashboardApi, "doctor").mockResolvedValue(doctorData); renderDashboard(<DoctorDashboard />); await screen.findByRole("heading", { name: "Today's schedule" });
    expect(screen.getAllByRole("link", { name: "Open appointment 4: Patient 4" })[0]).toHaveAttribute("href", "/doctor/appointments/4");
    const nextCard = screen.getAllByRole("link", { name: "Open appointment 4: Patient 4" })[1];
    expect(nextCard).toHaveTextContent("Ready");
  });

  it("Doctor Next patient falls back to upcoming and ignores finished appointments", async () => {
    setUser("DOCTOR"); vi.spyOn(dashboardApi, "doctor").mockResolvedValue({ ...doctorData, own_active_visit: null, today_appointments: [appointment(9, "COMPLETED", 8), appointment(10, "CANCELLED", 9), appointment(11, "NO_SHOW", 10), appointment(12, "UPCOMING", 11)] }); renderDashboard(<DoctorDashboard />);
    const nextCard = (await screen.findAllByRole("link", { name: "Open appointment 12: Patient 12" }))[1];
    expect(nextCard).toHaveTextContent("Next"); expect(screen.getByText("No active visit.")).toBeInTheDocument();
  });

  it("Doctor shows calm no-active and no-more-patients states", async () => {
    setUser("DOCTOR"); vi.spyOn(dashboardApi, "doctor").mockResolvedValue({ ...doctorData, own_active_visit: null, today_appointments: [appointment(9, "COMPLETED"), appointment(10, "CANCELLED")] }); renderDashboard(<DoctorDashboard />);
    expect(await screen.findByText("No active visit.")).toBeInTheDocument(); expect(screen.getByText("No more scheduled patients today.")).toBeInTheDocument();
  });

  it("localizes all role dashboard headings and new copy in Arabic", async () => {
    setUser("ADMIN", "AR"); mockAdmin(); const { unmount } = renderDashboard(<AdminDashboard />); expect(await screen.findByRole("heading", { name: "لوحة التحكم" })).toBeInTheDocument(); expect(screen.getByText("نشاط الفوترة")).toBeInTheDocument(); unmount(); vi.restoreAllMocks();
    setUser("STAFF", "AR"); vi.spyOn(dashboardApi, "staff").mockResolvedValue(staffData); renderDashboard(<StaffDashboard />); expect(await screen.findByRole("heading", { name: "لوحة موظفي الاستقبال" })).toBeInTheDocument();
  });

  it("shows loading and retries the authoritative Admin request after failure", async () => {
    setUser("ADMIN"); let resolveDashboard: (value: AdminDashboardResponse) => void = () => undefined;
    vi.spyOn(dashboardApi, "admin").mockImplementationOnce(() => Promise.reject(new Error("unavailable"))).mockImplementationOnce(() => new Promise((resolve) => { resolveDashboard = resolve; }));
    renderDashboard(<AdminDashboard />); expect(await screen.findByText("Dashboard unavailable")).toBeInTheDocument(); fireEvent.click(screen.getByRole("button", { name: "Retry" })); await screen.findByLabelText("Loading dashboard"); await act(async () => resolveDashboard(adminData)); expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
  });
});
