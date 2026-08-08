import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AppointmentListItem, AppointmentViewMode } from "../../types/appointments";
import { AppointmentsPage } from "./AppointmentsPage";

const mocks = vi.hoisted(() => ({
  useAppointments: vi.fn(),
  create: { mutateAsync: vi.fn(), isPending: false, error: null },
}));

vi.mock("../../features/appointments/hooks/useAppointments", () => ({ useAppointments: () => mocks.useAppointments() }));
vi.mock("../../features/appointments/hooks/useDoctors", () => ({ useDoctors: () => ({ data: [], isLoading: false, isError: false }) }));
vi.mock("../../features/appointments/hooks/useAppointmentMutations", () => ({ useCreateAppointment: () => mocks.create }));

const item: AppointmentListItem = {
  id: 47,
  patient: { id: 10, first_name: "Maya", last_name: "Patient", full_name: "Maya Patient", gender: "Female", date_of_birth: null, age: 31, phone_number: "555", email: "", national_id_or_passport: null, blood_group: "", is_archived: false, version: 1, created_at: "2026-07-01T00:00:00Z", updated_at: "2026-07-01T00:00:00Z" },
  doctor: { id: 20, full_name: "Dr. Lin", email: "lin@example.com", role: "DOCTOR", is_active: true, theme_preference: "SYSTEM", language_preference: "EN" },
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
};

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="location">{location.pathname}{location.search}</output>;
}

function renderPage(view: AppointmentViewMode, initialPath?: string) {
  const path = `/staff/appointments/${view}`;
  return render(
    <MemoryRouter initialEntries={[initialPath ?? `${path}?date=${view === "month" ? "2026-07-01" : "2026-07-13"}`]}>
      <Routes>
        <Route path={path} element={<AppointmentsPage role="STAFF" view={view} />} />
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AppointmentsPage navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useAppointments.mockReturnValue({
      data: { count: 1, next: null, previous: null, results: [item], clinic_date: "2026-07-13", clinic_timezone: "UTC" },
      isLoading: false,
      isError: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  it.each(["day", "week", "month", "list", "needs-reschedule"] as AppointmentViewMode[])("opens an exact appointment from the %s view", async (view) => {
    renderPage(view);

    await userEvent.click(screen.getByLabelText(/^Open appointment 47/));
    expect(screen.getByLabelText("location")).toHaveTextContent("/staff/appointments/47");
  });

  it.each([
    ["week", ".appointment-calendar-column[data-date='2026-07-14']"],
    ["month", ".appointment-month-cell[data-date='2026-07-14']"],
  ] as const)("drills from an empty %s day surface and preserves bounded filters", (view, selector) => {
    const { container } = renderPage(view, `/staff/appointments/${view}?date=${view === "month" ? "2026-07-01" : "2026-07-13"}&doctor=9&status=UPCOMING&search=Maya&page=4`);

    fireEvent.doubleClick(container.querySelector<HTMLElement>(selector)!);
    expect(screen.getByLabelText("location")).toHaveTextContent("/staff/appointments/day?doctor=9&status=UPCOMING&search=Maya&date=2026-07-14&page=1");
  });
});
