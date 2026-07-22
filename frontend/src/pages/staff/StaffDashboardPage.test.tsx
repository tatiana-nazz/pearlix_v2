import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

const { dashboardData } = vi.hoisted(() => ({
  dashboardData: {
    today_appointments_count: 7,
    upcoming_today_appointments: [{ id: 11, patient: { id: 1, full_name: "Ada Patient", phone_number: "555-0100" }, doctor: { id: 2, full_name: "Dr Noor", email: "noor@example.test", role: "DOCTOR" }, start_datetime: "2026-07-12T09:00:00Z", end_datetime: "2026-07-12T09:30:00Z", duration_minutes: 30, status: "UPCOMING", reason: "Review" }],
    checked_in_appointments: [{ id: 12, patient: { id: 3, full_name: "Mina Queue", phone_number: "555-0101" }, doctor: { id: 2, full_name: "Dr Noor", email: "noor@example.test", role: "DOCTOR" }, start_datetime: "2026-07-12T10:00:00Z", end_datetime: "2026-07-12T10:30:00Z", duration_minutes: 30, status: "CHECKED_IN", reason: "Cleaning" }],
    needs_reschedule_appointments: [{ id: 13, patient: { id: 4, full_name: "Sam Review", phone_number: "555-0102" }, doctor: { id: 2, full_name: "Dr Noor", email: "noor@example.test", role: "DOCTOR" }, start_datetime: "2026-07-12T11:00:00Z", end_datetime: "2026-07-12T11:30:00Z", duration_minutes: 30, status: "NEEDS_RESCHEDULE", reason: "Conflict" }],
    pending_billing_handoffs: [{ id: 21, patient: { id: 5, full_name: "Ira Billing", phone_number: "555-0103" }, visit_id: 31, doctor: { id: 2, full_name: "Dr Noor", email: "noor@example.test", role: "DOCTOR" }, suggested_amount: "25", currency: "USD", status: "PENDING", created_at: "2026-07-12T12:00:00Z" }],
    unpaid_or_partially_paid_invoices: [{ id: 41, invoice_number: "INV-41", patient: { id: 6, full_name: "Lee Invoice", phone_number: "555-0104" }, currency: "USD", total_amount: "100", paid_amount: "50", remaining_amount: "50", status: "PARTIALLY_PAID", created_at: "2026-07-12T12:30:00Z" }],
    recent_patients: [{ id: 7, full_name: "Nora Recent", phone_number: "555-0105" }],
    own_working_schedule: [], own_availability_exceptions: [], doctor_unavailable_exceptions: [],
  },
}));

vi.mock("@tanstack/react-query", () => ({ useQuery: () => ({ isLoading: false, isError: false, data: dashboardData, refetch: vi.fn() }) }));

import { StaffDashboardPage } from "./StaffDashboardPage";

describe("Staff dashboard visual composition", () => {
  it("renders exactly four semantic main KPIs from the current backend response", () => {
    render(<MemoryRouter><StaffDashboardPage /></MemoryRouter>);
    const mainKpis = screen.getByTestId("staff-main-kpis");
    const cards = mainKpis.querySelectorAll(".kpi-card");
    expect(cards).toHaveLength(4);
    expect(Array.from(cards).map((card) => card.className)).toEqual(expect.arrayContaining(["v2-card kpi-card info", "v2-card kpi-card success", "v2-card kpi-card warning", "v2-card kpi-card danger"]));
    expect(Array.from(cards).map((card) => card.querySelector(".kpi-value")?.textContent)).toEqual(["7", "1", "1", "1"]);
    expect(mainKpis.querySelectorAll(".kpi-card")).not.toHaveLength(5);
  });

  it("keeps KPI labels, values, helpers, and actions in separate elements and exposes both primary actions", () => {
    render(<MemoryRouter><StaffDashboardPage /></MemoryRouter>);
    const card = screen.getByTestId("staff-main-kpis").querySelector(".kpi-card")!;
    expect(card.querySelector(".kpi-label")).toHaveTextContent("Today's appointments");
    expect(card.querySelector(".kpi-value")).toHaveTextContent("7");
    expect(card.querySelector(".kpi-helper")).toHaveTextContent("Local clinic schedule");
    expect(card.querySelector(".kpi-footer")).toHaveTextContent("Open schedule");
    expect(screen.getByRole("link", { name: "Add Appointment" })).toHaveAttribute("href", "/staff/appointments/day");
    expect(screen.getByRole("link", { name: "New Patient" })).toHaveAttribute("href", "/staff/patients/new");
    expect(screen.getByRole("heading", { name: "Today's appointments" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Checked-in queue" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Needs Reschedule" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Unpaid or partial invoices" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Patients" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Search patients" })).toBeInTheDocument();
  });

  it("maps counts from live response fields instead of permanent display counts", () => {
    const source = readFileSync(resolve(__dirname, "StaffDashboardPage.tsx"), "utf8");
    expect(source).toContain("data.today_appointments_count");
    expect(source).toContain("data.checked_in_appointments.length");
    expect(source).toContain("data.needs_reschedule_appointments.length");
    expect(source).toContain("data.unpaid_or_partially_paid_invoices.length");
    expect(source).not.toMatch(/value:\s*\d+/);
  });
});
