import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AppointmentDetail } from "../../types/appointments";
import type { UserRole } from "../../types/auth";
import { AppointmentDetailPage } from "./AppointmentDetailPage";

const mocks = vi.hoisted(() => {
  const mutation = () => ({ mutateAsync: vi.fn(), reset: vi.fn(), isPending: false, error: null });
  return {
    useAppointment: vi.fn(),
    checkIn: mutation(),
    cancel: mutation(),
    noShow: mutation(),
    startVisit: mutation(),
  };
});

vi.mock("../../features/appointments/hooks/useAppointments", () => ({
  useAppointment: (id: number) => mocks.useAppointment(id),
}));

vi.mock("../../features/appointments/hooks/useAppointmentMutations", () => ({
  useCheckInAppointment: () => mocks.checkIn,
  useCancelAppointment: () => mocks.cancel,
  useNoShowAppointment: () => mocks.noShow,
  useStartAppointmentVisit: () => mocks.startVisit,
  useUpdateAppointment: () => ({ mutateAsync: vi.fn(), isPending: false, error: null }),
}));

const item: AppointmentDetail = {
  id: 47,
  patient: { id: 10, first_name: "Maya", last_name: "Patient", full_name: "Maya Patient", gender: "Female", date_of_birth: null, age: 31, phone_number: "555", email: "", national_id_or_passport: null, blood_group: "", is_archived: false, version: 1, created_at: "2026-07-01T00:00:00Z", updated_at: "2026-07-01T00:00:00Z" },
  doctor: { id: 20, full_name: "Dr. Lin", email: "lin@example.com", role: "DOCTOR", is_active: true, theme_preference: "SYSTEM", language_preference: "EN" },
  start_datetime: "2026-07-10T09:00:00Z",
  end_datetime: "2026-07-10T09:30:00Z",
  duration_minutes: 30,
  reason: "Cleaning",
  notes: "Bring prior images",
  status: "UPCOMING",
  version: 1,
  reschedule_source_exception: null,
  reschedule_source_working_shift: null,
  reschedule_source_type: null,
  reschedule_source_label: null,
  reschedule_previous_status: null,
  created_by: null,
  updated_by: null,
  created_at: "2026-07-01T00:00:00Z",
  updated_at: "2026-07-02T00:00:00Z",
};

function renderDetail(role: UserRole, path = `/${role.toLowerCase()}/appointments/47`) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={`/${role.toLowerCase()}/appointments/:appointmentId`} element={<AppointmentDetailPage role={role} />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AppointmentDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useAppointment.mockReturnValue({ data: item, isLoading: false, isError: false, error: null, refetch: vi.fn() });
  });

  it("loads the exact direct-route ID and links the exact patient", () => {
    renderDetail("ADMIN");

    expect(mocks.useAppointment).toHaveBeenCalledWith(47);
    expect(screen.getByRole("heading", { name: "Maya Patient" })).toBeInTheDocument();
    expect(screen.getByText("Dr. Lin")).toBeInTheDocument();
    expect(screen.getByText("Cleaning")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Maya Patient" })).toHaveAttribute("href", "/admin/patients/10");
  });

  it("shows the standard state for an invalid direct route", () => {
    renderDetail("ADMIN", "/admin/appointments/not-a-number");

    expect(screen.getByRole("heading", { name: "Appointment not found" })).toBeInTheDocument();
    expect(mocks.useAppointment).toHaveBeenCalledWith(Number.NaN);
  });

  it("keeps Admin detail read-only", () => {
    renderDetail("ADMIN");

    for (const action of ["Edit", "Reschedule", "Check in", "Mark no-show", "Cancel", "Start visit"]) {
      expect(screen.queryByRole("button", { name: action })).not.toBeInTheDocument();
    }
  });

  it("shows only the currently permitted Staff actions", () => {
    renderDetail("STAFF");

    for (const action of ["Edit", "Reschedule", "Check in", "Mark no-show", "Cancel"]) {
      expect(screen.getByRole("button", { name: action })).toBeInTheDocument();
    }
    expect(screen.queryByRole("button", { name: "Start visit" })).not.toBeInTheDocument();
  });

  it("shows only the current Doctor action for a checked-in appointment", () => {
    mocks.useAppointment.mockReturnValue({ data: { ...item, status: "CHECKED_IN" }, isLoading: false, isError: false, error: null, refetch: vi.fn() });
    renderDetail("DOCTOR");

    expect(screen.getByRole("button", { name: "Start visit" })).toBeInTheDocument();
    for (const action of ["Edit", "Reschedule", "Check in", "Mark no-show", "Cancel"]) {
      expect(screen.queryByRole("button", { name: action })).not.toBeInTheDocument();
    }
  });
});
