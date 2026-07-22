import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

const dashboard = {
  total_active_patients: 12, today_appointments_count: 7, needs_reschedule_appointments_count: 2, pending_billing_handoffs_count: 3, unpaid_invoices_count: 4,
  checked_in_appointments_count: 2, active_visits_count: 1,
  recent_appointments: [],
};
vi.mock("@tanstack/react-query", () => ({ useQuery: () => ({ isLoading: false, isError: false, data: dashboard, refetch: vi.fn() }) }));

import { AdminDashboardPage } from "./AdminDashboardPage";

describe("Admin dashboard composition", () => {
  it("renders exactly four primary API-derived KPI cards without handoff content", () => {
    render(<MemoryRouter><AdminDashboardPage /></MemoryRouter>);
    const cards = document.querySelectorAll(".dashboard-kpi-grid .kpi-card");
    expect(cards).toHaveLength(4);
    expect(Array.from(cards).map((card) => card.querySelector(".kpi-value")?.textContent)).toEqual(["12", "7", "2", "4"]);
    expect(document.querySelector(".dashboard-page > .v2-card:last-child")?.textContent).not.toContain("Pending handoffs");
    expect(screen.getByRole("link", { name: "Clinic settings" })).toHaveAttribute("href", "/admin/clinic-settings");
    expect(screen.getByRole("link", { name: "Users & Access" })).toHaveAttribute("href", "/admin/users");
    expect(screen.getByRole("heading", { name: "Needs attention" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Appointments" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Clinic summary" })).toBeInTheDocument();
  });
});
