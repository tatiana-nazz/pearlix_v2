import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ScheduleMatrix } from "./ScheduleMatrix";

const shifts = [
  { id: 1, name: "Morning", weekday: 0, start_time: "09:00:00", end_time: "13:00:00", is_active: true },
  { id: 2, name: "Friday stored", weekday: 4, start_time: "10:00:00", end_time: "14:00:00", is_active: true },
];

describe("ScheduleMatrix clinic operating week", () => {
  it("distinguishes Off from Clinic closed while retaining stored shift context and Shift N labels", () => {
    render(<ScheduleMatrix shifts={shifts} language="EN" emptyText="No shifts" weeklyClosedDays={[4]} />);

    expect(screen.getByRole("rowheader", { name: "Shift 1" })).toBeInTheDocument();
    expect(screen.queryByText("Morning")).not.toBeInTheDocument();
    const closed = screen.getByRole("cell", { name: /Clinic closed Stored shift/ });
    expect(closed).toHaveAttribute("data-clinic-closed", "true");
    expect(within(closed).getByText("10:00–14:00")).toBeInTheDocument();
    expect(screen.getAllByText("Off").length).toBeGreaterThan(0);
  });

  it("localizes the authoritative closure state in Arabic", () => {
    render(<ScheduleMatrix shifts={shifts} language="AR" emptyText="لا مناوبات" weeklyClosedDays={[4]} />);

    expect(screen.getByRole("rowheader", { name: "المناوبة 1" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: /العيادة مغلقة/ })).toBeInTheDocument();
  });
});
