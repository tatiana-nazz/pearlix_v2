import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as appointmentsApi from "../../api/endpoints/appointments";
import { clinicApi } from "../../api/endpoints/clinic";
import { dashboardApi } from "../../api/endpoints/dashboard";
import { useAuthStore } from "../../auth/authStore";
import type { AdminDashboardResponse, DashboardAppointmentSummary, DoctorDashboardResponse, StaffDashboardResponse } from "../../types/dashboard";
import { AdminDashboard } from "./AdminDashboard";
import { DoctorDashboard } from "./DoctorDashboard";
import { StaffDashboard } from "./StaffDashboard";

const appointment = (id: number, status: DashboardAppointmentSummary["status"] = "CHECKED_IN"): DashboardAppointmentSummary => ({ id, patient: { id: id + 10, full_name: `Patient ${id}`, phone_number: "0911000000" }, doctor: { id: 3, full_name: "Dr Sami", email: "doctor@example.test", role: "DOCTOR" }, start_datetime: "2026-08-08T09:00:00+03:00", end_datetime: "2026-08-08T09:30:00+03:00", duration_minutes: 30, status, reason: `Reason ${id}` });
const handoff = { id: 12, patient: { id: 8, full_name: "Maya Hassan", phone_number: "0911000000" }, description: "Restorative care", currency: "SYP" as const, total_amount: "120000.00", paid_amount: "20000.00", remaining_amount: "100000.00", status: "PARTIALLY_PAID" as const, created_at: "2026-08-08T08:00:00+03:00" };
const counts = { UPCOMING: 4, CHECKED_IN: 2, ACTIVE: 1, COMPLETED: 8, NEEDS_RESCHEDULE: 3, CANCELLED: 1, NO_SHOW: 0 };
const activity = [{ date: "2026-08-08", SYP: { billed: "300000.00", collected: "150000.00" }, USD: { billed: "75.00", collected: "40.00" } }];
const adminData: AdminDashboardResponse = {
  clinic_date: "2026-08-08",
  clinic_timezone: "Asia/Damascus",
  today_appointments_count: 2,
  checked_in_appointments_count: 1,
  needs_reschedule_appointments_count: 3,
  active_visits_count: 2,
  open_bills_count: 7,
  partially_paid_bills_count: 2,
  today_invoices_count: 4,
  collected_today: { SYP: "150000.00", USD: "40.00" },
  today_appointments: [appointment(4)],
  appointment_status_last_7_days: counts,
  billing_activity_last_30_days: activity,
  appointments_daily_last_30_days: [{ date: "2026-08-08", ...counts }],
  doctor_utilization_last_30_days: [{ doctor: { id: 3, full_name: "Dr Sami" }, booked_minutes: 180, available_minutes: 360, utilization_percent: 50 }],
  patient_mix_last_8_weeks: [{ week_start: "2026-08-03", new: 3, returning: 5 }],
  appointment_problem_rate_last_8_weeks: [{ week_start: "2026-08-03", scheduled: 10, cancelled: 1, no_show: 1, rate_percent: 20 }],
  receivables_aging: [{ bucket: "0_7", SYP: "100000.00", USD: "25.00" }],
  recent_handoffs: [handoff],
};
const staffData: StaffDashboardResponse = { clinic_date: "2026-08-08", clinic_timezone: "Asia/Damascus", today_appointments_count: 2, patients_ready_count: 1, needs_reschedule_count: 3, open_bills_count: 4, partially_paid_bills_count: 2, today_invoices_count: 4, collected_today: { SYP: "150000.00", USD: "40.00" }, today_appointments: [appointment(4)], open_handoffs: [handoff] };
const doctorData: DoctorDashboardResponse = { clinic_date: "2026-08-08", clinic_timezone: "Asia/Damascus", today_appointments_count: 1, patients_ready_count: 1, completed_today_count: 2, needs_reschedule_count: 0, today_appointments: [appointment(4)], own_active_visit: { id: 70, patient: appointment(4).patient, appointment_id: 4, appointment_reason: "Review", appointment_start_datetime: appointment(4).start_datetime, status: "ACTIVE", started_at: "2026-08-08T09:05:00+03:00", completed_at: null } };

function renderDashboard(node: React.ReactNode) { const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); return render(<QueryClientProvider client={client}><MemoryRouter>{node}</MemoryRouter></QueryClientProvider>); }
function setUser(role: "ADMIN" | "STAFF" | "DOCTOR") { useAuthStore.setState({ user: { id: 1, full_name: "Dashboard User", email: "user@example.test", role, is_active: true, must_change_password: false, password_changed_at: null, theme_preference: "LIGHT", language_preference: "EN" } }); }

describe("role dashboards", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(appointmentsApi, "getAllAppointments").mockResolvedValue({ count: 0, next: null, previous: null, results: [], clinic_date: "2026-08-08", clinic_timezone: "Asia/Damascus" });
    vi.spyOn(clinicApi, "getSettings").mockResolvedValue({ clinic_name: "Pearlix", address: "", phone: "", email: "", timezone: "Asia/Damascus", capacity_per_slot: 1, default_appointment_duration_minutes: 30, allowed_durations_minutes: [30], default_currency: "SYP", supported_currencies: ["SYP"], default_language: "EN", weekly_closed_days: [6] });
  });
  it("routes Admin bill KPIs and recent obligations to Handoffs", async () => {
    setUser("ADMIN");
    vi.spyOn(dashboardApi, "admin").mockResolvedValue(adminData);
    renderDashboard(<AdminDashboard />);
    expect(await screen.findByRole("link", { name: "Open bills: 7" })).toHaveAttribute("href", "/admin/billing/handoffs?status=OPEN");
    expect(screen.getByRole("link", { name: "Partially paid bills 2" })).toHaveAttribute("href", "/admin/billing/handoffs?status=PARTIALLY_PAID");
    expect(screen.getByRole("link", { name: "Bill 12: Maya Hassan" })).toHaveAttribute("href", "/admin/billing/handoffs/12");
    const sypBillingChart = screen.getByRole("img", { name: "SYP Billed vs collected" });
    expect(sypBillingChart.closest(".analytics-billing-panel")).toHaveTextContent(/Billed:.*300,000.*Collected:.*150,000/);
    expect(await screen.findByRole("button", { name: /2026-08-09: Clinic closed/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /2026-08-14: 0 Booked/ })).toBeInTheDocument();
  });
  it("shows Staff bills requiring payment follow-up and today's receipts", async () => { setUser("STAFF"); vi.spyOn(dashboardApi, "staff").mockResolvedValue(staffData); renderDashboard(<StaffDashboard />); expect(await screen.findByRole("link", { name: "Open bills: 4" })).toHaveAttribute("href", "/staff/billing/handoffs?status=OPEN"); expect(screen.getByRole("link", { name: "Today's invoices: 4" })).toHaveAttribute("href", "/staff/billing/invoices?date_from=2026-08-08&date_to=2026-08-08"); expect(screen.getByRole("link", { name: "Bill 12: Maya Hassan" })).toHaveAttribute("href", "/staff/billing/handoffs/12"); expect(screen.getByRole("heading", { name: "Bills requiring payment follow-up" })).toBeInTheDocument(); });
  it("keeps Doctor dashboard clinical and free of financial actions", async () => { setUser("DOCTOR"); vi.spyOn(dashboardApi, "doctor").mockResolvedValue(doctorData); renderDashboard(<DoctorDashboard />); expect(await screen.findByRole("heading", { name: "Doctor dashboard" })).toBeInTheDocument(); expect(screen.getAllByRole("link", { name: "Continue visit" })[0]).toHaveAttribute("href", "/doctor/visits/active"); expect(screen.queryByText("Open bills")).not.toBeInTheDocument(); });
});
