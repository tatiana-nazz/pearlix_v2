import { render, screen } from "@testing-library/react";
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
});
