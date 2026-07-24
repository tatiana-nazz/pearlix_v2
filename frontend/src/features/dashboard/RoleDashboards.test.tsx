import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { dashboardApi } from "../../api/endpoints/dashboard";
import { useAuthStore } from "../../auth/authStore";
import type { AdminDashboardResponse, DoctorDashboardResponse, StaffDashboardResponse } from "../../types/dashboard";
import { AdminDashboard } from "./AdminDashboard";
import { DoctorDashboard } from "./DoctorDashboard";
import { StaffDashboard } from "./StaffDashboard";

const appointment = { id: 4, patient: { id: 8, full_name: "Maya Hassan", phone_number: "0911000000" }, doctor: { id: 3, full_name: "Dr Sami", email: "doctor@example.test", role: "DOCTOR" as const }, start_datetime: "2026-07-20T09:00:00+03:00", end_datetime: "2026-07-20T09:30:00+03:00", duration_minutes: 30, status: "CHECKED_IN" as const, reason: "Review" };
const adminData: AdminDashboardResponse = { clinic_date: "2026-07-20", clinic_timezone: "Asia/Damascus", total_active_patients: 12, today_appointments_count: 4, checked_in_appointments_count: 1, needs_reschedule_appointments_count: 2, active_visits_count: 1, pending_billing_handoffs_count: 0, unpaid_invoices_count: 0, recent_appointments: [appointment], recent_invoices: [] };
const staffData: StaffDashboardResponse = { clinic_date: "2026-07-20", clinic_timezone: "Asia/Damascus", today_appointments_count: 4, upcoming_today_appointments: [appointment], checked_in_appointments: [appointment], needs_reschedule_appointments: [], pending_billing_handoffs: [], unpaid_or_partially_paid_invoices: [], recent_patients: [], own_working_schedule: [], own_availability_exceptions: [], doctor_unavailable_exceptions: [] };
const doctorData: DoctorDashboardResponse = { clinic_date: "2026-07-20", clinic_timezone: "Asia/Damascus", today_own_appointments: [appointment], own_checked_in_appointments: [appointment], own_needs_reschedule_appointments: [], own_active_visit: null, own_completed_visits_today_count: 1, own_recent_visits: [], own_pending_billing_handoffs: [], own_working_schedule: [], own_availability_exceptions: [] };

function renderDashboard(page: React.ReactNode) { const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); return render(<QueryClientProvider client={client}><MemoryRouter>{page}</MemoryRouter></QueryClientProvider>); }
function setUser(role: "ADMIN" | "STAFF" | "DOCTOR", language_preference: "EN" | "AR" = "EN") { useAuthStore.setState({ user: { id: 1, full_name: "Dashboard User", email: "user@example.test", role, is_active: true, must_change_password: false, password_changed_at: null, theme_preference: "LIGHT", language_preference } }); }

describe("role dashboards", () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => { useAuthStore.getState().clearAuth(); });

  it("renders supervisory Admin metrics and management-only shortcuts", async () => {
    setUser("ADMIN"); vi.spyOn(dashboardApi, "admin").mockResolvedValue(adminData);
    renderDashboard(<AdminDashboard />);
    expect(await screen.findByRole("heading", { name: "Clinic overview" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Active patients: 12/ })).toHaveAttribute("href", "/admin/patients");
    expect(screen.getByRole("link", { name: "Team" })).toHaveAttribute("href", "/admin/team");
    expect(screen.queryByRole("link", { name: "New appointment" })).not.toBeInTheDocument();
  });

  it("renders Staff queue and only Staff operational shortcuts", async () => {
    setUser("STAFF"); vi.spyOn(dashboardApi, "staff").mockResolvedValue(staffData);
    renderDashboard(<StaffDashboard />);
    expect(await screen.findByRole("heading", { name: "Front desk overview" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "New appointment" })).toHaveAttribute("href", "/staff/appointments/day");
    expect(screen.getByRole("link", { name: "New patient" })).toHaveAttribute("href", "/staff/patients/new");
    expect(screen.queryByRole("link", { name: "Team" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open active visit" })).not.toBeInTheDocument();
  });

  it("renders Doctor clinical context without billing, check-in, or appointment creation", async () => {
    setUser("DOCTOR"); vi.spyOn(dashboardApi, "doctor").mockResolvedValue(doctorData);
    renderDashboard(<DoctorDashboard />);
    expect(await screen.findByRole("heading", { name: "Clinical workspace" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Patients" })).toHaveAttribute("href", "/doctor/patients");
    expect(screen.getAllByText("Checked in")).not.toHaveLength(0);
    expect(screen.queryByRole("link", { name: "Billing" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "New appointment" })).not.toBeInTheDocument();
  });

  it("localizes the Doctor dashboard and status labels in Arabic", async () => {
    setUser("DOCTOR", "AR"); vi.spyOn(dashboardApi, "doctor").mockResolvedValue(doctorData);
    renderDashboard(<DoctorDashboard />);
    expect(await screen.findByRole("heading", { name: "\u0645\u0633\u0627\u062d\u0629 \u0627\u0644\u0639\u0645\u0644 \u0627\u0644\u0633\u0631\u064a\u0631\u064a\u0629" })).toBeInTheDocument();
    expect(screen.getAllByText("\u062a\u0645 \u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062d\u0636\u0648\u0631")).not.toHaveLength(0);
    expect(screen.queryByText("CHECKED_IN")).not.toBeInTheDocument();
  });

  it("localizes the Admin dashboard in Arabic", async () => {
    setUser("ADMIN", "AR"); vi.spyOn(dashboardApi, "admin").mockResolvedValue(adminData);
    renderDashboard(<AdminDashboard />);
    expect(await screen.findByRole("heading", { name: "\u0646\u0638\u0631\u0629 \u0639\u0627\u0645\u0629 \u0639\u0644\u0649 \u0627\u0644\u0639\u064a\u0627\u062f\u0629" })).toBeInTheDocument();
  });

  it("localizes the Staff dashboard in Arabic", async () => {
    setUser("STAFF", "AR"); vi.spyOn(dashboardApi, "staff").mockResolvedValue(staffData);
    renderDashboard(<StaffDashboard />);
    expect(await screen.findByRole("heading", { name: "\u0646\u0638\u0631\u0629 \u0639\u0627\u0645\u0629 \u0639\u0644\u0649 \u0627\u0644\u0627\u0633\u062a\u0642\u0628\u0627\u0644" })).toBeInTheDocument();
  });

  it("shows a loading state before the dashboard response arrives", async () => {
    setUser("ADMIN");
    let resolveDashboard: (value: AdminDashboardResponse) => void = () => undefined;
    vi.spyOn(dashboardApi, "admin").mockImplementation(() => new Promise<AdminDashboardResponse>((resolve) => { resolveDashboard = resolve; }));
    renderDashboard(<AdminDashboard />);
    expect(screen.getByLabelText("Loading dashboard")).toBeInTheDocument();
    await act(async () => { resolveDashboard(adminData); });
    expect(await screen.findByRole("heading", { name: "Clinic overview" })).toBeInTheDocument();
  });

  it("offers a retry after an initial dashboard failure", async () => {
    setUser("ADMIN");
    const request = vi.spyOn(dashboardApi, "admin").mockRejectedValueOnce(new Error("unavailable")).mockResolvedValue(adminData);
    renderDashboard(<AdminDashboard />);
    expect(await screen.findByText("Dashboard unavailable")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("heading", { name: "Clinic overview" })).toBeInTheDocument();
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("renders an empty Staff queue without hiding the dashboard", async () => {
    setUser("STAFF"); vi.spyOn(dashboardApi, "staff").mockResolvedValue({ ...staffData, upcoming_today_appointments: [], checked_in_appointments: [], needs_reschedule_appointments: [] });
    renderDashboard(<StaffDashboard />);
    expect(await screen.findByRole("heading", { name: "Front desk overview" })).toBeInTheDocument();
    expect(screen.getByText("No appointments are waiting right now.")).toBeInTheDocument();
  });

  it("keeps rendered content available while a manual refresh is in flight", async () => {
    setUser("ADMIN"); const refresh = vi.spyOn(dashboardApi, "admin").mockResolvedValue(adminData);
    renderDashboard(<AdminDashboard />);
    await screen.findByRole("heading", { name: "Clinic overview" });
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(screen.getByRole("heading", { name: "Clinic overview" })).toBeInTheDocument();
    expect(refresh).toHaveBeenCalledTimes(2);
  });
});
