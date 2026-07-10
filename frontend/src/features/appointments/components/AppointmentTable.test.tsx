import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import type { AppointmentListItem } from "../../../types/appointments";
import { AppointmentTable } from "./AppointmentTable";

const base = {
  id: 1,
  patient: { id: 10, full_name: "Maya Patient", phone: "555", gender: "FEMALE", birth_date: null, age: 31, is_archived: false },
  doctor: { id: 20, full_name: "Dr. Lin", email: "lin@example.com", role: "DOCTOR", is_active: true },
  start_datetime: "2026-07-10T09:00:00Z",
  end_datetime: "2026-07-10T09:30:00Z",
  duration_minutes: 30,
  reason: "Cleaning",
  status: "UPCOMING",
  reschedule_source_exception: null,
  reschedule_previous_status: null,
  created_at: "2026-07-01T00:00:00Z",
  updated_at: "2026-07-01T00:00:00Z",
} as AppointmentListItem;

describe("AppointmentTable", () => {
  it("shows Staff actions without status patch controls", () => {
    render(
      <MemoryRouter>
        <AppointmentTable role="STAFF" appointments={[base]} onStatusAction={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "Check in" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /status/i })).not.toBeInTheDocument();
  });

  it("renders multiple needs reschedule appointments in the full table", () => {
    const rows = [
      { ...base, id: 1, status: "NEEDS_RESCHEDULE" },
      { ...base, id: 2, patient: { ...base.patient, full_name: "Nora Patient" }, status: "NEEDS_RESCHEDULE" },
    ] as AppointmentListItem[];

    render(
      <MemoryRouter>
        <AppointmentTable role="STAFF" appointments={rows} />
      </MemoryRouter>,
    );

    expect(screen.getByText("Maya Patient")).toBeInTheDocument();
    expect(screen.getByText("Nora Patient")).toBeInTheDocument();
  });
});
