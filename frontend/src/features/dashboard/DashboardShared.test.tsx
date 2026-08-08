import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import type { DashboardAppointmentSummary } from "../../types/dashboard";
import { DashboardList } from "./DashboardShared";

const item: DashboardAppointmentSummary = {
  id: 47,
  patient: { id: 10, full_name: "Maya Patient", phone_number: "555" },
  doctor: { id: 20, full_name: "Dr. Lin", email: "lin@example.com", role: "DOCTOR" },
  start_datetime: "2026-07-13T09:00:00Z",
  end_datetime: "2026-07-13T09:30:00Z",
  duration_minutes: 30,
  status: "UPCOMING",
  reason: "Cleaning",
};

describe("DashboardList", () => {
  it("opens the exact appointment without adding a separate status link", () => {
    render(<MemoryRouter><DashboardList language="EN" clinicTimezone="UTC" items={[item]} empty="Empty" role="ADMIN" showDoctor /></MemoryRouter>);

    const appointmentLink = screen.getByRole("link", { name: /Maya Patient/ });
    expect(appointmentLink).toHaveAttribute("href", "/admin/appointments/47");
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });
});
