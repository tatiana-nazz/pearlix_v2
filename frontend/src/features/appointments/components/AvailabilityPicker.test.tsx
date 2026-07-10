import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { AppointmentAvailability } from "../../../types/appointments";
import { AvailabilityPicker } from "./AvailabilityPicker";

const availability: AppointmentAvailability = {
  doctor_id: 1,
  date: "2026-07-10",
  duration_minutes: 30,
  capacity_per_slot: 1,
  available_slots: [{ start_datetime: "2026-07-10T09:00:00Z", end_datetime: "2026-07-10T09:30:00Z", current_count: 0, capacity: 1 }],
};

describe("AvailabilityPicker", () => {
  it("selects a returned availability slot", async () => {
    const onSelect = vi.fn();
    render(<AvailabilityPicker availability={availability} onSelect={onSelect} />);

    await userEvent.click(screen.getByRole("button"));

    expect(onSelect).toHaveBeenCalledWith(availability.available_slots[0]);
  });
});
