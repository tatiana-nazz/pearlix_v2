import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import type { DashboardAppointmentSummary } from "../../types/dashboard";
import { DashboardAppointmentList, SimpleStatusBarChart } from "./DashboardShared";

const item: DashboardAppointmentSummary = { id: 47, patient: { id: 10, full_name: "Maya Patient", phone_number: "555" }, doctor: { id: 20, full_name: "Dr. Lin", email: "lin@example.com", role: "DOCTOR" }, start_datetime: "2026-07-13T09:00:00Z", end_datetime: "2026-07-13T09:30:00Z", duration_minutes: 30, status: "UPCOMING", reason: "Cleaning" };

describe("dashboard shared presentation", () => {
  it("opens the exact appointment with one whole-row link", () => {
    render(<MemoryRouter><DashboardAppointmentList language="EN" clinicTimezone="UTC" items={[item]} empty="Empty" role="ADMIN" showDoctor /></MemoryRouter>);
    expect(screen.getByRole("link", { name: "Open appointment 47: Maya Patient" })).toHaveAttribute("href", "/admin/appointments/47");
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("exposes every status count in text and semantic classes", () => {
    render(<SimpleStatusBarChart language="EN" counts={{ UPCOMING: 3, CHECKED_IN: 2, ACTIVE: 1, COMPLETED: 5, NEEDS_RESCHEDULE: 4, CANCELLED: 0, NO_SHOW: 0 }} />);
    expect(screen.getByRole("img")).toHaveAccessibleName(/Upcoming: 3.*Needs reschedule: 4.*No show: 0/);
    expect(document.querySelector('[data-status="NEEDS_RESCHEDULE"]')).toHaveClass("status-warning");
    expect(document.querySelector('[data-status="CANCELLED"]')).toHaveClass("status-danger");
  });
});
