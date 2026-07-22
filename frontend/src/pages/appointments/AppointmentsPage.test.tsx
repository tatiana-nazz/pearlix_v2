import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "../../auth/authStore";

const hookState = vi.hoisted(() => ({
  rows: [{
    id: 1,
    patient: { id: 11, first_name: "Maya", last_name: "Patient", full_name: "Maya Patient", gender: "Female", date_of_birth: null, age: 32, phone_number: "555", email: "", national_id_or_passport: null, blood_group: "", is_archived: false, version: 1, created_at: "2026-07-01T00:00:00Z", updated_at: "2026-07-01T00:00:00Z" },
    doctor: { id: 7, email: "doctor@example.test", full_name: "Dr. Lin", role: "DOCTOR", is_active: true, theme_preference: "LIGHT", language_preference: "EN" },
    start_datetime: "2026-07-14T10:00:00Z", end_datetime: "2026-07-14T10:30:00Z", duration_minutes: 30, reason: "Review", status: "UPCOMING", reschedule_source_exception: null, reschedule_source_working_shift: null, reschedule_source_type: null, reschedule_source_label: null, reschedule_previous_status: null, created_at: "2026-07-01T00:00:00Z", updated_at: "2026-07-01T00:00:00Z",
  }],
  refetch: vi.fn(),
}));

vi.mock("../../features/appointments/hooks/useAppointments", () => ({
  useAppointments: () => ({ data: { results: hookState.rows, count: hookState.rows.length, next: null, previous: null }, isLoading: false, isError: false, isFetching: false, error: null, refetch: hookState.refetch }),
  useAppointmentRange: () => ({ data: hookState.rows, isLoading: false, isError: false, isFetching: false, error: null, refetch: hookState.refetch }),
}));
vi.mock("../../features/appointments/hooks/useDoctors", () => ({ useDoctors: () => ({ data: [], isLoading: false, error: null, refetch: hookState.refetch }) }));
vi.mock("../../features/appointments/hooks/useClinicSafeSettings", () => ({ useClinicSafeSettings: () => ({ data: { allowed_durations_minutes: [30], default_appointment_duration_minutes: 30, timezone: "Asia/Damascus", capacity_per_slot: 1 }, isLoading: false, error: null, refetch: hookState.refetch }) }));
vi.mock("../../features/patients/hooks/usePatients", () => ({ usePatients: () => ({ data: { results: [] }, isLoading: false, error: null, refetch: hookState.refetch }) }));
vi.mock("../../features/appointments/hooks/useAppointmentMutations", () => ({
  useCreateAppointment: () => ({ mutateAsync: vi.fn(), isPending: false, error: null }),
  useUpdateAppointment: () => ({ mutateAsync: vi.fn(), isPending: false, error: null }),
  useCheckInAppointment: () => ({ mutateAsync: vi.fn(), isPending: false, error: null, reset: vi.fn() }),
  useCancelAppointment: () => ({ mutateAsync: vi.fn(), isPending: false, error: null, reset: vi.fn() }),
  useNoShowAppointment: () => ({ mutateAsync: vi.fn(), isPending: false, error: null, reset: vi.fn() }),
  useStartAppointmentVisit: () => ({ mutateAsync: vi.fn(), isPending: false, error: null, reset: vi.fn() }),
}));
vi.mock("../../features/appointments/components/AppointmentDetailsModal", () => ({ AppointmentDetailsModal: () => null }));

import { AppointmentsPage } from "./AppointmentsPage";

function renderPage(role: "ADMIN" | "STAFF" | "DOCTOR", view: "day" | "week" | "month" | "list" | "needs-reschedule" = "day") {
  return render(<MemoryRouter initialEntries={[`/${role.toLowerCase()}/appointments/${view}?date=2026-07-14`]}><AppointmentsPage role={role} view={view} /></MemoryRouter>);
}

describe("AppointmentsPage", () => {
  beforeEach(() => {
    hookState.refetch.mockReset();
    useAuthStore.setState({ user: { language_preference: "EN" } as never, role: null });
  });

  afterEach(() => useAuthStore.setState({ user: null, role: null }));

  it("gives Staff a dated appointment workspace and keeps date navigation reachable", () => {
    renderPage("STAFF");
    expect(screen.getByRole("heading", { name: "Day Appointments" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add Appointment" })).toBeInTheDocument();
    expect(screen.getByText("Tuesday, July 14, 2026")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Previous day" }));
    expect(screen.getByText("Monday, July 13, 2026")).toBeInTheDocument();
  });

  it("keeps Admin read-only while preserving the populated appointment workspace", () => {
    renderPage("ADMIN", "list");
    expect(screen.getByRole("heading", { name: "Appointment List" })).toBeInTheDocument();
    expect(screen.getByText("Maya Patient")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add Appointment" })).not.toBeInTheDocument();
  });

  it("does not expose Staff appointment controls to Doctors", () => {
    renderPage("DOCTOR", "week");
    expect(screen.getByRole("heading", { name: "Week Appointments" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add Appointment" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Needs Reschedule" })).not.toBeInTheDocument();
  });
});
