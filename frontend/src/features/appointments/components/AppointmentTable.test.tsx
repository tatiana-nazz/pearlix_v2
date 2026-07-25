import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { AppointmentListItem } from "../../../types/appointments";
import { AppointmentDetailsDialog } from "./AppointmentDetailsDialog";
import { AppointmentTable } from "./AppointmentTable";

const base = {
  id: 1,
  patient: {
    id: 10,
    first_name: "Maya",
    last_name: "Patient",
    full_name: "Maya Patient",
    gender: "Female",
    date_of_birth: null,
    age: 31,
    phone_number: "555",
    email: "",
    national_id_or_passport: null,
    blood_group: "",
    is_archived: false,
    version: 1,
    created_at: "2026-07-01T00:00:00Z",
    updated_at: "2026-07-01T00:00:00Z",
  },
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
  it("opens Staff records as a whole row without collection action controls", () => {
    const onDetails = vi.fn();
    render(<AppointmentTable appointments={[base]} onDetails={onDetails} />);

    expect(screen.queryByRole("button", { name: "Check in" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "more" })).not.toBeInTheDocument();
    expect(screen.queryByText("Appointment action")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Maya Patient"));
    expect(onDetails).toHaveBeenCalledWith(base);
  });

  it("renders multiple needs reschedule appointments in the full table", () => {
    const rows = [
      { ...base, id: 1, status: "NEEDS_RESCHEDULE" },
      { ...base, id: 2, patient: { ...base.patient, first_name: "Nora", full_name: "Nora Patient" }, status: "NEEDS_RESCHEDULE" },
    ] as AppointmentListItem[];

    render(
      <AppointmentTable appointments={rows} />,
    );

    expect(screen.getByText("Maya Patient")).toBeInTheDocument();
    expect(screen.getByText("Nora Patient")).toBeInTheDocument();
  });

  it.each(["ADMIN", "DOCTOR"] as const)("keeps %s collection rows action-free", () => {
    render(<AppointmentTable appointments={[base]} />);

    expect(screen.queryByRole("button", { name: "Check in" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reschedule" })).not.toBeInTheDocument();
  });

  it("keeps Staff appointment actions inside the opened detail surface", () => {
    const onEdit = vi.fn();
    const onReschedule = vi.fn();
    const onStatusAction = vi.fn();
    render(<AppointmentDetailsDialog appointment={base} role="STAFF" onClose={vi.fn()} onEdit={onEdit} onReschedule={onReschedule} onStatusAction={onStatusAction} onStartVisit={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Reschedule" }));
    fireEvent.click(screen.getByRole("button", { name: "Check in" }));
    fireEvent.click(screen.getByRole("button", { name: "Mark no-show" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onEdit).toHaveBeenCalledWith(base);
    expect(onReschedule).toHaveBeenCalledWith(base);
    expect(onStatusAction).toHaveBeenNthCalledWith(1, base, "check-in");
    expect(onStatusAction).toHaveBeenNthCalledWith(2, base, "no-show");
    expect(onStatusAction).toHaveBeenNthCalledWith(3, base, "cancel");
  });

  it("shows Start visit only for a Doctor's opened checked-in appointment", () => {
    const onStartVisit = vi.fn();
    render(<AppointmentDetailsDialog appointment={{ ...base, status: "CHECKED_IN" }} role="DOCTOR" onClose={vi.fn()} onEdit={vi.fn()} onReschedule={vi.fn()} onStatusAction={vi.fn()} onStartVisit={onStartVisit} />);

    fireEvent.click(screen.getByRole("button", { name: "Start visit" }));
    expect(onStartVisit).toHaveBeenCalledWith(expect.objectContaining({ id: base.id, status: "CHECKED_IN" }));
  });
});
