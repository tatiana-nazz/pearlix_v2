import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { ApiClientError } from "../../api/errors";
import * as patientHooks from "../../features/patients/hooks/usePatient";
import * as patientMutations from "../../features/patients/hooks/usePatientMutations";
import { PatientProfilePage } from "./PatientProfilePage";

vi.mock("../../features/patients/hooks/usePatient", () => ({
  usePatient: vi.fn(), usePatientAiResults: vi.fn(), usePatientAppointments: vi.fn(), usePatientVisits: vi.fn(), usePatientXrays: vi.fn(),
}));
vi.mock("../../features/patients/hooks/usePatientMutations", () => ({ useArchivePatient: vi.fn(), useUnarchivePatient: vi.fn(), useUpdatePatient: vi.fn() }));

const patient = { id: 9, version: 3, is_archived: false, first_name: "Nour", last_name: "Haddad", full_name: "Nour Haddad", gender: "Female" as const, date_of_birth: null, age: 28, phone_number: "+963 11", email: "nour@example.test", national_id_or_passport: null, blood_group: "" as const, address: "Damascus", emergency_contact: "Hadi", medical_conditions_history: "", insurance_info: "", general_notes: "", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z", created_by: null, updated_by: null };
const idleQuery = { data: undefined, isLoading: false, error: null, refetch: vi.fn() };

function renderPage() {
  return render(<MemoryRouter initialEntries={["/staff/patients/9"]}><Routes><Route path="/staff/patients/:patientId" element={<PatientProfilePage role="STAFF" />} /></Routes></MemoryRouter>);
}

function mockPage(refetch: ReturnType<typeof vi.fn>, reset = vi.fn()) {
  vi.mocked(patientHooks.usePatient).mockReturnValue({ data: patient, isLoading: false, isError: false, error: null, refetch } as never);
  vi.mocked(patientHooks.usePatientVisits).mockReturnValue(idleQuery as never);
  vi.mocked(patientHooks.usePatientAppointments).mockReturnValue(idleQuery as never);
  vi.mocked(patientHooks.usePatientXrays).mockReturnValue(idleQuery as never);
  vi.mocked(patientHooks.usePatientAiResults).mockReturnValue(idleQuery as never);
  vi.mocked(patientMutations.useUpdatePatient).mockReturnValue({ isPending: false, error: new ApiClientError({ code: "VERSION_CONFLICT", message: "Changed elsewhere", details: {}, status: 409 }), reset, mutateAsync: vi.fn() } as never);
  vi.mocked(patientMutations.useArchivePatient).mockReturnValue({ isPending: false, error: null, reset: vi.fn(), mutateAsync: vi.fn() } as never);
  vi.mocked(patientMutations.useUnarchivePatient).mockReturnValue({ isPending: false, error: null, reset: vi.fn(), mutateAsync: vi.fn() } as never);
  return reset;
}

describe("Patient profile production route", () => {
  it("keeps reload confirmation inside the edit overlay, traps focus, and restores its trigger after a successful reload", async () => {
    const reset = mockPage(vi.fn().mockResolvedValue({ error: null }));
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Edit patient/i }));
    const firstName = document.querySelector<HTMLInputElement>("#edit-patient-first-name");
    expect(firstName).toHaveValue("Nour");
    fireEvent.change(firstName!, { target: { value: "Noura" } });
    const reload = screen.getByRole("button", { name: "Reload latest record" });
    fireEvent.click(reload);

    const prompt = await screen.findByRole("alertdialog", { name: "Reload the latest patient record and discard unsaved edits?" });
    expect(prompt).not.toHaveAttribute("aria-modal");
    const continueButton = within(prompt).getByRole("button", { name: "Continue reviewing my changes" });
    await waitFor(() => expect(continueButton).toHaveFocus());
    fireEvent.keyDown(within(prompt).getByRole("button", { name: "Reload latest record" }), { key: "Tab" });
    expect(continueButton).toHaveFocus();
    const reloadChoices = screen.getAllByRole("button", { name: "Reload latest record" });
    fireEvent.click(reloadChoices[reloadChoices.length - 1]!);

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    await waitFor(() => expect(reload).toHaveFocus());
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("keeps the reload subdialog open and shows the request failure", async () => {
    mockPage(vi.fn().mockResolvedValue({ error: new Error("Network unavailable") }));
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Edit patient/i }));
    fireEvent.click(screen.getByRole("button", { name: "Reload latest record" }));
    await screen.findByRole("alertdialog", { name: "Reload the latest patient record and discard unsaved edits?" });
    const reloadChoices = screen.getAllByRole("button", { name: "Reload latest record" });
    fireEvent.click(reloadChoices[reloadChoices.length - 1]!);

    expect(await screen.findByText("Network unavailable")).toBeInTheDocument();
    expect(screen.getByRole("alertdialog", { name: "Reload the latest patient record and discard unsaved edits?" })).toBeInTheDocument();
  });
});
