import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { getPatients } from "../../../api/endpoints/patients";
import type { AppointmentDetail } from "../../../types/appointments";
import type { PatientListItem } from "../../../types/patients";
import { AppointmentForm } from "./AppointmentForm";

vi.mock("../../../api/endpoints/patients", () => ({ getPatients: vi.fn() }));

const doctors = [{ id: 7, full_name: "Dr. Lin", email: "lin@example.com", role: "DOCTOR", is_active: true, doctor_profile: null }] as const;
const maya: PatientListItem = {
  id: 42,
  first_name: "Maya",
  last_name: "Patient",
  full_name: "Maya Patient",
  gender: "Female",
  date_of_birth: "1995-05-20",
  age: 31,
  phone_number: "555 0101",
  email: "maya@example.com",
  national_id_or_passport: null,
  blood_group: "",
  is_archived: false,
  version: 1,
  created_at: "2026-07-01T00:00:00Z",
  updated_at: "2026-07-01T00:00:00Z",
};

const existingAppointment: AppointmentDetail = {
  id: 91,
  patient: maya,
  doctor: { id: 7, full_name: "Dr. Lin", email: "lin@example.com", role: "DOCTOR", is_active: true, theme_preference: "SYSTEM", language_preference: "EN" },
  start_datetime: "2026-07-10T09:00:00",
  end_datetime: "2026-07-10T09:30:00",
  duration_minutes: 30,
  reason: "Review",
  notes: "Existing note",
  status: "UPCOMING",
  version: 7,
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

function renderForm(onSubmit = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return {
    onSubmit,
    user: userEvent.setup(),
    ...render(
      <QueryClientProvider client={queryClient}>
        <AppointmentForm mode="create" doctors={[...doctors]} initialDate="2026-07-10" initialDoctorId={7} onSubmit={onSubmit} />
      </QueryClientProvider>,
    ),
  };
}

describe("AppointmentForm", () => {
  afterEach(() => vi.clearAllMocks());

  it("requires a selected patient instead of exposing a raw patient ID field", async () => {
    vi.mocked(getPatients).mockResolvedValue({ count: 0, next: null, previous: null, results: [] });
    const { user, onSubmit } = renderForm();

    expect(screen.queryByLabelText("Patient ID")).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Patient" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save appointment" }));

    expect(await screen.findByText("Patient is required.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(getPatients).not.toHaveBeenCalled();
  });

  it("searches active patients, supports keyboard selection, and submits only the backend patient identifier", async () => {
    vi.mocked(getPatients).mockResolvedValue({ count: 1, next: null, previous: null, results: [maya] });
    const { user, onSubmit } = renderForm();
    const combobox = screen.getByRole("combobox", { name: "Patient" });

    await user.type(combobox, "  Maya ");
    await waitFor(() => expect(getPatients).toHaveBeenCalledWith({ search: "Maya", is_archived: false }));
    expect(await screen.findByRole("option", { name: /Maya Patient/ })).toHaveTextContent("555 0101");

    await user.keyboard("{ArrowDown}{Enter}");
    expect(screen.getByText("Selected patient: Maya Patient")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save appointment" }));

    expect(onSubmit).toHaveBeenCalledWith({
      patient_id: 42,
      doctor_id: 7,
      start_datetime: "2026-07-10T09:00:00",
      duration_minutes: 30,
      reason: "",
      notes: "",
    });
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty("patient");
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty("status");
  });

  it("supports pointer selection, clear selection, and preserves a chosen patient after a backend validation error", async () => {
    vi.mocked(getPatients).mockResolvedValue({ count: 1, next: null, previous: null, results: [maya] });
    const { user, rerender } = renderForm();
    const combobox = screen.getByRole("combobox", { name: "Patient" });

    await user.type(combobox, "Maya");
    await waitFor(() => expect(screen.getByRole("option", { name: /Maya Patient/ })).toBeInTheDocument());
    await user.click(screen.getByRole("option", { name: /Maya Patient/ }));
    expect(screen.getByText("Selected patient: Maya Patient")).toBeInTheDocument();

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    rerender(
      <QueryClientProvider client={queryClient}>
        <AppointmentForm
          mode="create"
          doctors={[...doctors]}
          initialDate="2026-07-10"
          initialDoctorId={7}
          error={{ details: { patient_id: ["Invalid pk."] } }}
          onSubmit={vi.fn()}
        />
      </QueryClientProvider>,
    );
    expect(screen.getByText("Selected patient: Maya Patient")).toBeInTheDocument();
    expect(screen.getByText("This patient is unavailable or archived. Choose another patient.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear selected patient" }));
    expect(screen.queryByText("Selected patient: Maya Patient")).not.toBeInTheDocument();
  });

  it("submits the server-issued appointment version for optimistic edit protection", async () => {
    const onSubmit = vi.fn();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <AppointmentForm mode="edit" doctors={[...doctors]} appointment={existingAppointment} onSubmit={onSubmit} />
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Save appointment" }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ version: 7 }));
  });
});
