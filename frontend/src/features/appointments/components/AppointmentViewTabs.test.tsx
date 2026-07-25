import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { AppointmentViewTabs } from "./AppointmentViewTabs";

describe("AppointmentViewTabs", () => {
  it("renders needs reschedule as a tab route", () => {
    render(
      <MemoryRouter initialEntries={["/staff/appointments/needs-reschedule"]}>
        <AppointmentViewTabs role="STAFF" views={["day", "week", "month", "list", "needs-reschedule"]} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Needs reschedule" })).toHaveAttribute("href", "/staff/appointments/needs-reschedule");
  });
});
