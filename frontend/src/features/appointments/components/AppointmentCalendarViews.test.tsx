import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { AppointmentListItem } from "../../../types/appointments";
import { AppointmentMonthView } from "./AppointmentMonthView";
import { AppointmentWeekView } from "./AppointmentWeekView";

const appointment: AppointmentListItem = {
  id: 1,
  patient: { id: 4, first_name: "Maya", last_name: "Patient", full_name: "Maya Patient", gender: "Female", date_of_birth: null, age: 31, phone_number: "555", email: "", national_id_or_passport: null, blood_group: "", is_archived: false, version: 1, created_at: "2026-07-01T00:00:00Z", updated_at: "2026-07-01T00:00:00Z" },
  doctor: {
    id: 2,
    full_name: "Dr Lin",
    email: "lin@example.com",
    role: "DOCTOR",
    is_active: true,
    theme_preference: "SYSTEM",
    language_preference: "EN",
  },
  start_datetime: "2026-07-12T21:30:00Z",
  end_datetime: "2026-07-12T22:00:00Z",
  duration_minutes: 30,
  reason: "Review",
  status: "UPCOMING",
  reschedule_source_exception: null,
  reschedule_source_working_shift: null,
  reschedule_source_type: null,
  reschedule_source_label: null,
  reschedule_previous_status: null,
  created_at: "2026-07-01T00:00:00Z",
  updated_at: "2026-07-01T00:00:00Z",
};

describe("appointment calendar views", () => {
  it("groups Week appointments by clinic-local date and lets a user open that day", async () => {
    const onDaySelect = vi.fn();
    render(<AppointmentWeekView role="STAFF" date="2026-07-13" timezone="Asia/Damascus" appointments={[appointment]} onDetails={vi.fn()} onDaySelect={onDaySelect} />);

    expect(screen.getByText("Maya Patient")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Open day Jul 13, 2026" }));
    expect(onDaySelect).toHaveBeenCalledWith("2026-07-13");
  });

  it("lets a user activate a Month day to move to Day view", async () => {
    const onDaySelect = vi.fn();
    render(<AppointmentMonthView date="2026-07-01" timezone="Asia/Damascus" appointments={[appointment]} onDetails={vi.fn()} onDaySelect={onDaySelect} />);

    await userEvent.click(screen.getByRole("button", { name: "Open day 2026-07-13" }));
    expect(onDaySelect).toHaveBeenCalledWith("2026-07-13");
  });

  it("uses shared semantic tones and status-inclusive accessible labels for every Month status", async () => {
    const statuses = ["UPCOMING", "CHECKED_IN", "ACTIVE", "COMPLETED", "NEEDS_RESCHEDULE", "CANCELLED", "NO_SHOW"] as const;
    const expectedTone = ["status-info", "status-teal", "status-ai", "status-success", "status-warning", "status-danger", "status-danger"];
    const appointments = statuses.map((status, index) => ({
      ...appointment,
      id: index + 10,
      status,
      patient: { ...appointment.patient, full_name: `Long Patient Name ${index}` },
      start_datetime: `2026-07-${String(index + 6).padStart(2, "0")}T08:00:00Z`,
      end_datetime: `2026-07-${String(index + 6).padStart(2, "0")}T08:30:00Z`,
    }));
    const onDetails = vi.fn();
    const { container } = render(<AppointmentMonthView date="2026-07-01" timezone="UTC" appointments={appointments} onDetails={onDetails} onDaySelect={vi.fn()} />);

    statuses.forEach((status, index) => {
      const item = container.querySelector<HTMLButtonElement>(`.appointment-month-item[data-status="${status}"]`);
      expect(item).toHaveClass(expectedTone[index]);
      expect(item).toHaveAttribute("aria-label", expect.stringContaining(`Long Patient Name ${index}`));
      expect(item).toHaveAttribute("aria-label", expect.stringContaining(status === "NO_SHOW" ? "No-show" : status === "CHECKED_IN" ? "Checked in" : status === "NEEDS_RESCHEDULE" ? "Needs reschedule" : status.charAt(0) + status.slice(1).toLowerCase()));
    });
    expect(within(container).queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    await userEvent.click(container.querySelector<HTMLButtonElement>('[data-status="UPCOMING"]')!);
    expect(onDetails).toHaveBeenCalledWith(expect.objectContaining({ status: "UPCOMING" }));
  });
});
