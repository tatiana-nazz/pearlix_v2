import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { AppointmentViewTabs, AppointmentWorkspaceTabs } from "./AppointmentViewTabs";

describe("AppointmentViewTabs", () => {
  it("renders all four calendar views and preserves filters", () => {
    render(
      <MemoryRouter initialEntries={["/staff/appointments/week?search=Amina"]}>
        <AppointmentViewTabs role="STAFF" views={["day", "week", "month", "list"]} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "Day" })).toHaveAttribute("href", "/staff/appointments/day?search=Amina");
    expect(screen.getByRole("link", { name: "Week" })).toHaveClass("active");
    expect(screen.getByRole("link", { name: "Month" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "List" })).toBeInTheDocument();
  });

  it("keeps the reschedule queue beside the calendar as a sibling workspace tab", () => {
    render(<MemoryRouter initialEntries={["/staff/appointments/needs-reschedule?date=2026-07-26&calendar_view=month"]}><AppointmentWorkspaceTabs role="STAFF" queue view="needs-reschedule" /></MemoryRouter>);
    expect(screen.getByRole("link", { name: "Calendar" })).toHaveAttribute("href", "/staff/appointments/month?date=2026-07-26");
    expect(screen.getByRole("link", { name: "Reschedule Queue" })).toHaveClass("active");
  });
});
