import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "../../../auth/authStore";
import type { AppointmentDetail } from "../../../types/appointments";
import { RescheduleAppointmentPanel } from "./RescheduleAppointmentPanel";

const availability = vi.hoisted(() => vi.fn());
vi.mock("../hooks/useAppointments", () => ({ useAppointmentAvailability: (filters: unknown) => availability(filters) }));

const appointment = {
  id: 10,
  patient: { id: 20, full_name: "Maya Patient" },
  doctor: { id: 1, full_name: "Doctor One", email: "one@example.test", role: "DOCTOR", is_active: true },
  start_datetime: "2026-07-10T09:00:00Z",
  end_datetime: "2026-07-10T09:30:00Z",
  duration_minutes: 30,
  reason: "Review",
  notes: "",
  status: "NEEDS_RESCHEDULE",
  version: 4,
  reschedule_source_exception: null,
  reschedule_source_working_shift: null,
  reschedule_source_type: null,
  reschedule_source_label: null,
  reschedule_previous_status: "UPCOMING",
  created_by: null,
  updated_by: null,
  created_at: "2026-07-01T00:00:00Z",
  updated_at: "2026-07-01T00:00:00Z",
} as AppointmentDetail;

describe("RescheduleAppointmentPanel", () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null });
    availability.mockReturnValue({
      data: {
        doctor_id: 1, date: "2026-07-10", duration_minutes: 30, capacity_per_slot: 1, clinic_closed: false,
        available_slots: [{ start_datetime: "2026-07-10T10:00:00Z", end_datetime: "2026-07-10T10:30:00Z", current_count: 0, capacity: 1 }],
      },
      isLoading: false, error: null, refetch: vi.fn(),
    });
  });

  it("clears a selected slot whenever doctor, date, or duration changes", () => {
    render(<RescheduleAppointmentPanel appointment={appointment} clinicTimezone="UTC" doctors={[
      { id: 1, full_name: "Doctor One", email: "one@example.test", role: "DOCTOR", is_active: true, doctor_profile: null },
      { id: 2, full_name: "Doctor Two", email: "two@example.test", role: "DOCTOR", is_active: true, doctor_profile: null },
    ]} onSubmit={vi.fn()} />);
    const save = screen.getByRole("button", { name: "Save reschedule" });
    fireEvent.click(screen.getByRole("button", { name: /booked/ }));
    expect(save).toBeEnabled();
    fireEvent.change(screen.getByLabelText("Doctor"), { target: { value: "2" } });
    expect(save).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /booked/ }));
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-07-11" } });
    expect(save).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /booked/ }));
    fireEvent.change(screen.getByLabelText("Duration"), { target: { value: "60" } });
    expect(save).toBeDisabled();
  });
});
