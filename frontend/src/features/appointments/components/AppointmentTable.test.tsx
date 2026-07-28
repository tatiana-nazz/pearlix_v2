import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import type { AppointmentListItem } from "../../../types/appointments";
import { AppointmentTable } from "./AppointmentTable";

const base = {
  id: 1, patient: { id: 10, first_name: "Maya", last_name: "Patient", full_name: "Maya Patient", gender: "Female", date_of_birth: null, age: 31, phone_number: "555", email: "", national_id_or_passport: null, blood_group: "", is_archived: false, version: 1, created_at: "2026-07-01T00:00:00Z", updated_at: "2026-07-01T00:00:00Z" }, doctor: { id: 20, full_name: "Dr. Lin", email: "lin@example.com", role: "DOCTOR", is_active: true }, start_datetime: "2026-07-10T09:00:00Z", end_datetime: "2026-07-10T09:30:00Z", duration_minutes: 30, reason: "Cleaning", status: "UPCOMING", reschedule_source_exception: null, reschedule_source_working_shift: null, reschedule_source_type: null, reschedule_source_label: null, reschedule_previous_status: null, created_at: "2026-07-01T00:00:00Z", updated_at: "2026-07-01T00:00:00Z",
} as AppointmentListItem;

describe("AppointmentTable", () => {
  it("has no collection action controls and opens the complete row by mouse, Enter, and Space", () => {
    const open = vi.fn(); render(<MemoryRouter><AppointmentTable role="STAFF" appointments={[base]} onDetails={open} /></MemoryRouter>);
    expect(screen.queryByRole("columnheader", { name: "Actions" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /edit|reschedule|check in|cancel|no-show|start visit|view/i })).not.toBeInTheDocument();
    const row = screen.getByRole("row", { name: /Maya Patient/ });
    expect(row.querySelector(".appointment-record")).toBeNull();
    expect(row.querySelector(".v2-status")).toBeInTheDocument();
    fireEvent.click(row); fireEvent.keyDown(row, { key: "Enter" }); fireEvent.keyDown(row, { key: " " });
    expect(open).toHaveBeenCalledTimes(3); expect(row).toHaveAttribute("aria-label", expect.stringContaining("Maya Patient"));
  });

  it("renders all needs-reschedule rows in the same action-free table", () => {
    const rows = [{ ...base, status: "NEEDS_RESCHEDULE" }, { ...base, id: 2, patient: { ...base.patient, full_name: "Nora Patient" }, status: "NEEDS_RESCHEDULE" }] as AppointmentListItem[];
    render(<MemoryRouter><AppointmentTable role="STAFF" appointments={rows} onDetails={vi.fn()} /></MemoryRouter>);
    expect(screen.getByText("Maya Patient")).toBeInTheDocument(); expect(screen.getByText("Nora Patient")).toBeInTheDocument();
  });
});
