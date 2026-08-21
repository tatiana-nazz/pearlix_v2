import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { AppointmentAvailability } from "../../../types/appointments";
import { useAuthStore } from "../../../auth/authStore";
import { AvailabilityPicker } from "./AvailabilityPicker";

const availability: AppointmentAvailability = {
  doctor_id: 1,
  date: "2026-07-10",
  duration_minutes: 30,
  capacity_per_slot: 1,
  clinic_closed: false,
  available_slots: [{ start_datetime: "2026-07-10T09:00:00Z", end_datetime: "2026-07-10T09:30:00Z", current_count: 0, capacity: 1 }],
};

describe("AvailabilityPicker", () => {
  it("selects a returned availability slot", async () => {
    const onSelect = vi.fn();
    render(<AvailabilityPicker availability={availability} onSelect={onSelect} />);

    await userEvent.click(screen.getByRole("button"));

    expect(onSelect).toHaveBeenCalledWith(availability.available_slots[0]);
  });

  it("explains authoritative clinic closure instead of a generic lack of slots", () => {
    useAuthStore.setState({ user: null });
    render(<AvailabilityPicker availability={{ ...availability, clinic_closed: true, available_slots: [] }} onSelect={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent("Clinic closed");
    expect(screen.queryByText(/No available slots/)).not.toBeInTheDocument();
  });

  it("renders slot wall times in the configured clinic timezone", () => {
    render(<AvailabilityPicker clinicTimezone="UTC" availability={{ ...availability, available_slots: [{ ...availability.available_slots[0], start_datetime: "2026-08-23T09:00:00+03:00", end_datetime: "2026-08-23T09:30:00+03:00" }] }} onSelect={vi.fn()} />);
    expect(screen.getByRole("button", { name: /6:00 AM - 6:30 AM/ })).toBeInTheDocument();
  });
});
