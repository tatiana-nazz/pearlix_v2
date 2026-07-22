import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { AppointmentListItem } from "../../../types/appointments";
import { AppointmentDayView } from "./AppointmentDayView";
import { AppointmentMonthView } from "./AppointmentMonthView";
import { AppointmentWeekView } from "./AppointmentWeekView";

const patient = {
  id: 11,
  first_name: "Maya",
  last_name: "Patient",
  full_name: "Maya Patient",
  gender: "Female",
  date_of_birth: null,
  age: 32,
  phone_number: "555",
  email: "",
  national_id_or_passport: null,
  blood_group: "",
  is_archived: false,
  version: 1,
  created_at: "2026-07-01T00:00:00Z",
  updated_at: "2026-07-01T00:00:00Z",
} as const;

const doctor = {
  id: 7,
  email: "doctor@example.test",
  full_name: "Dr. Lin",
  role: "DOCTOR",
  is_active: true,
  theme_preference: "LIGHT",
  language_preference: "EN",
} as const;

function appointment(id: number, startDatetime: string, status: AppointmentListItem["status"] = "UPCOMING"): AppointmentListItem {
  return {
    id,
    patient,
    doctor,
    start_datetime: startDatetime,
    end_datetime: "2026-07-14T10:30:00Z",
    duration_minutes: 30,
    reason: "Review",
    status,
    reschedule_source_exception: null,
    reschedule_source_working_shift: null,
    reschedule_source_type: null,
    reschedule_source_label: null,
    reschedule_previous_status: null,
    created_at: "2026-07-01T00:00:00Z",
    updated_at: "2026-07-01T00:00:00Z",
  };
}

describe("appointment calendar presentation", () => {
  it("keeps the day record hierarchy and localized status in one accessible control", () => {
    const onDetails = vi.fn();
    render(<AppointmentDayView role="STAFF" appointments={[appointment(1, "2026-07-14T10:00:00Z", "CHECKED_IN")]} onDetails={onDetails} />);

    const record = screen.getByRole("button", { name: /Maya Patient/ });
    expect(record).toHaveClass("appointment-record--checked-in");
    expect(record).toHaveTextContent("Dr. Lin");
    expect(record).toHaveTextContent("30 minutes");
    expect(record).toHaveTextContent("Checked in");
    fireEvent.click(record);
    expect(onDetails).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
  });

  it("assigns week records to their exact calendar day and retains the Doctor restriction", () => {
    const onDetails = vi.fn();
    render(<AppointmentWeekView role="DOCTOR" date="2026-07-14" appointments={[appointment(2, "2026-07-14T10:00:00Z")]} onDetails={onDetails} onSelectDay={vi.fn()} onOpenDay={vi.fn()} />);

    expect(screen.getByText("Maya Patient")).toBeInTheDocument();
    expect(screen.queryByText("Dr. Lin")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Maya Patient/ })).toHaveClass("appointment-record--upcoming");
  });

  it("uses a dedicated month day control instead of nesting appointment controls", () => {
    const onSelectDay = vi.fn();
    const onDetails = vi.fn();
    render(<AppointmentMonthView date="2026-07-14" appointments={[appointment(3, "2026-07-14T10:00:00Z", "NEEDS_RESCHEDULE")]} onDetails={onDetails} onSelectDay={onSelectDay} onOpenDay={vi.fn()} />);

    const dayControl = screen.getByRole("button", { name: "Selected day: View day: Jul 14, 2026" });
    expect(dayControl.querySelector("button")).toBeNull();
    fireEvent.click(dayControl);
    expect(onSelectDay).toHaveBeenCalledWith("2026-07-14");
    const record = screen.getByRole("button", { name: /Maya Patient/ });
    expect(record).toHaveClass("appointment-record--needs-reschedule");
    fireEvent.click(record);
    expect(onDetails).toHaveBeenCalledWith(expect.objectContaining({ id: 3 }));
  });
});
