import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clinicApi } from "../../api/endpoints/clinic";
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
  version: 1,
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
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}><MemoryRouter initialEntries={[initialPath ?? `${path}?date=${view === "month" ? "2026-07-01" : "2026-07-13"}`]}>
      <Routes>
        <Route path={path} element={<AppointmentsPage role="STAFF" view={view} />} />
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter></QueryClientProvider>,
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
    vi.spyOn(clinicApi, "getSettings").mockResolvedValue({ clinic_name: "Pearlix", address: "", phone: "", email: "", timezone: "UTC", capacity_per_slot: 1, default_appointment_duration_minutes: 30, allowed_durations_minutes: [30], default_currency: "SYP", supported_currencies: ["SYP"], default_language: "EN", weekly_closed_days: [6] });
  });
  afterEach(() => vi.restoreAllMocks());

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

  it("labels a configured closed Day without hiding historical rows", async () => {
    mocks.useAppointments.mockReturnValue({
      data: { count: 1, next: null, previous: null, results: [{ ...item, status: "COMPLETED", start_datetime: "2026-07-19T09:00:00Z" }], clinic_date: "2026-07-19", clinic_timezone: "UTC" },
      isLoading: false, isError: false, isFetching: false, error: null, refetch: vi.fn(),
    });
    renderPage("day", "/staff/appointments/day?date=2026-07-19");

    expect(await screen.findByRole("status")).toHaveTextContent("Clinic closed");
    expect(screen.getByText("Maya Patient")).toBeInTheDocument();
  });
});
