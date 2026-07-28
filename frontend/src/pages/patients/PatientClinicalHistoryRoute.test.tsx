import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import * as patientHooks from "../../features/patients/hooks/usePatient";
import * as patientMutations from "../../features/patients/hooks/usePatientMutations";
import { PatientProfilePage } from "./PatientProfilePage";

vi.mock("../../features/patients/hooks/usePatient", () => ({ usePatient: vi.fn(), usePatientAiResults: vi.fn(), usePatientAppointments: vi.fn(), usePatientVisits: vi.fn(), usePatientXrays: vi.fn() }));
vi.mock("../../features/patients/hooks/usePatientMutations", () => ({ useArchivePatient: vi.fn(), useUnarchivePatient: vi.fn(), useUpdatePatient: vi.fn() }));

const patient = { id: 9, first_name: "ليلى", last_name: "Haddad", full_name: "ليلى Haddad", gender: "Female" as const, date_of_birth: null, age: 31, phone_number: "+963 11", email: "layla@example.test", national_id_or_passport: null, blood_group: "" as const, is_archived: false, version: 3, created_at: "2026-01-01", updated_at: "2026-01-01", address: "", emergency_contact: "", medical_conditions_history: "", insurance_info: "", general_notes: "", created_by: null, updated_by: null };
const emptyQuery = { data: undefined, isLoading: false, isError: false, error: null, refetch: vi.fn() };

function renderRoute() {
  return render(<MemoryRouter initialEntries={["/doctor/patients/9/clinical-history"]}><Routes><Route path="/doctor/patients/:patientId/clinical-history" element={<PatientProfilePage role="DOCTOR" defaultTab="visits" />} /></Routes></MemoryRouter>);
}

function mockRoute(overrides = {}) {
  vi.mocked(patientHooks.usePatient).mockReturnValue({ data: patient, isLoading: false, isError: false, error: null, refetch: vi.fn(), ...overrides } as never);
  vi.mocked(patientHooks.usePatientVisits).mockReturnValue({ ...emptyQuery, data: { count: 0, next: null, previous: null, results: [] } } as never);
  vi.mocked(patientHooks.usePatientAppointments).mockReturnValue(emptyQuery as never);
  vi.mocked(patientHooks.usePatientXrays).mockReturnValue(emptyQuery as never);
  vi.mocked(patientHooks.usePatientAiResults).mockReturnValue(emptyQuery as never);
  vi.mocked(patientMutations.useUpdatePatient).mockReturnValue({ isPending: false, error: null, reset: vi.fn(), mutateAsync: vi.fn() } as never);
  vi.mocked(patientMutations.useArchivePatient).mockReturnValue({ isPending: false, error: null, reset: vi.fn(), mutateAsync: vi.fn() } as never);
  vi.mocked(patientMutations.useUnarchivePatient).mockReturnValue({ isPending: false, error: null, reset: vi.fn(), mutateAsync: vi.fn() } as never);
}

afterEach(() => { vi.clearAllMocks(); document.documentElement.lang = "en"; document.documentElement.dir = "ltr"; });

describe("Doctor clinical-history production route", () => {
  it("uses /doctor/patients/:patientId/clinical-history with Visits selected and only Visits enabled", () => {
    mockRoute();
    renderRoute();
    expect(screen.getByRole("tab", { name: "Visits" })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("tab", { name: "Billing & handoff" })).not.toBeInTheDocument();
    expect(vi.mocked(patientHooks.usePatientVisits)).toHaveBeenCalledWith(9, true);
    expect(vi.mocked(patientHooks.usePatientAppointments)).toHaveBeenCalledWith(9, false);
    expect(vi.mocked(patientHooks.usePatientXrays)).toHaveBeenCalledWith(9, false);
    expect(vi.mocked(patientHooks.usePatientAiResults)).toHaveBeenCalledWith(9, false);
    expect(screen.getAllByText("ليلى Haddad").some((element) => element.classList.contains("bidi-isolate"))).toBe(true);
  });

  it("shows loading, empty visits, retryable visit errors, and Arabic/RTL patient context", async () => {
    mockRoute({ isLoading: true, data: undefined });
    const { unmount } = renderRoute();
    expect(screen.getByText("Loading patient profile…")).toBeInTheDocument();
    unmount();
    mockRoute();
    renderRoute();
    expect(screen.getByText("No visits have been recorded for this patient.")).toBeInTheDocument();
    document.documentElement.lang = "ar"; document.documentElement.dir = "rtl";
    expect(screen.getAllByText("ليلى Haddad")).toHaveLength(2);
    expect(document.documentElement).toHaveAttribute("dir", "rtl");
    fireEvent.click(screen.getByRole("tab", { name: "Visits" }));
    await waitFor(() => expect(vi.mocked(patientHooks.usePatientVisits)).toHaveBeenCalled());
  });

  it("keeps the clinical-history route on patient 9 and exposes a retryable Visits query failure", () => {
    const retry = vi.fn();
    mockRoute();
    vi.mocked(patientHooks.usePatientVisits).mockReturnValue({ ...emptyQuery, isLoading: false, error: new Error("Visits unavailable"), refetch: retry } as never);
    renderRoute();
    expect(screen.getByText("Unable to load visits")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalledTimes(1);
    expect(vi.mocked(patientHooks.usePatient)).toHaveBeenCalledWith(9);
    expect(screen.getByRole("tab", { name: "Visits" })).toHaveAttribute("aria-selected", "true");
  });
});
