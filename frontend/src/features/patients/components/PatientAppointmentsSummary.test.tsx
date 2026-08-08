import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import type { AppointmentList } from "../../../types/appointments";
import { PatientAppointmentsSummary } from "./PatientAppointmentsSummary";

const appointment = {
  id: 47,
  patient: { id: 10, full_name: "Maya Patient" },
  doctor: { id: 20, full_name: "Dr. Lin" },
  start_datetime: "2026-07-13T09:00:00Z",
  end_datetime: "2026-07-13T09:30:00Z",
  duration_minutes: 30,
  reason: "Cleaning",
  status: "UPCOMING",
  reschedule_source_exception: null,
  reschedule_source_working_shift: null,
  reschedule_source_type: null,
  reschedule_source_label: null,
  reschedule_previous_status: null,
  created_at: "2026-07-01T00:00:00Z",
  updated_at: "2026-07-01T00:00:00Z",
} as AppointmentList;

describe("PatientAppointmentsSummary", () => {
  it("links each patient-profile appointment to its exact role-aware detail", () => {
    render(<MemoryRouter><PatientAppointmentsSummary role="DOCTOR" appointments={{ count: 1, next: null, previous: null, results: [appointment] }} isLoading={false} error={null} onRetry={vi.fn()} /></MemoryRouter>);

    expect(screen.getByRole("link", { name: "Open appointment" })).toHaveAttribute("href", "/doctor/appointments/47");
    expect(screen.queryByRole("link", { name: "Appointments" })).not.toBeInTheDocument();
  });
});
