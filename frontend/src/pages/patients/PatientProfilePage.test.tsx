import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import * as patientHooks from "../../features/patients/hooks/usePatient";
import * as patientMutations from "../../features/patients/hooks/usePatientMutations";
import { PatientProfilePage } from "./PatientProfilePage";

vi.mock("../../features/patients/hooks/usePatient", () => ({
  usePatient: vi.fn(), usePatientAiResults: vi.fn(), usePatientAppointments: vi.fn(), usePatientVisits: vi.fn(), usePatientXrays: vi.fn(),
}));
vi.mock("../../features/patients/hooks/usePatientMutations", () => ({ useArchivePatient: vi.fn(), useUnarchivePatient: vi.fn(), useUpdatePatient: vi.fn() }));
vi.mock("../../features/patients/components/PatientProfileHeader", () => ({ PatientProfileHeader: ({ onEdit }: { onEdit: () => void }) => <button type="button" onClick={onEdit}>Edit patient</button> }));
vi.mock("../../features/patients/components/PatientForm", () => ({
  updatePayloadFromForm: vi.fn(),
  PatientForm: ({ onReloadLatest, reloadLatestRef }: { onReloadLatest: () => void; reloadLatestRef: React.RefObject<HTMLButtonElement> }) => <button ref={reloadLatestRef} type="button" onClick={onReloadLatest}>Reload latest</button>,
}));
vi.mock("../../features/patients/components/PatientProfileTabs", () => ({ PatientProfileTabs: () => <div>Patient tabs</div> }));
vi.mock("../../features/patients/components/PatientOverview", () => ({ PatientOverview: () => <div>Patient overview</div> }));

const patient = { id: 9, version: 3, is_archived: false };
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
  vi.mocked(patientMutations.useUpdatePatient).mockReturnValue({ isPending: false, error: null, reset, mutateAsync: vi.fn() } as never);
  vi.mocked(patientMutations.useArchivePatient).mockReturnValue({ isPending: false, error: null, reset: vi.fn(), mutateAsync: vi.fn() } as never);
  vi.mocked(patientMutations.useUnarchivePatient).mockReturnValue({ isPending: false, error: null, reset: vi.fn(), mutateAsync: vi.fn() } as never);
  return reset;
}

describe("Patient profile production route", () => {
  it("keeps reload confirmation inside the edit overlay, traps focus, and restores its trigger after a successful reload", async () => {
    const reset = mockPage(vi.fn().mockResolvedValue({ error: null }));
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Edit patient" }));
    const reload = screen.getByRole("button", { name: "Reload latest" });
    fireEvent.click(reload);

    const prompt = await screen.findByRole("alertdialog", { name: "Reload the latest patient record and discard unsaved edits?" });
    expect(prompt).not.toHaveAttribute("aria-modal");
    const continueButton = screen.getByRole("button", { name: "Continue reviewing my changes" });
    await waitFor(() => expect(continueButton).toHaveFocus());
    fireEvent.keyDown(screen.getByRole("button", { name: "Reload latest record" }), { key: "Tab" });
    expect(continueButton).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Reload latest record" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    await waitFor(() => expect(reload).toHaveFocus());
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("keeps the reload subdialog open and shows the request failure", async () => {
    mockPage(vi.fn().mockResolvedValue({ error: new Error("Network unavailable") }));
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Edit patient" }));
    fireEvent.click(screen.getByRole("button", { name: "Reload latest" }));
    fireEvent.click(await screen.findByRole("button", { name: "Reload latest record" }));

    expect(await screen.findByText("Network unavailable")).toBeInTheDocument();
    expect(screen.getByRole("alertdialog", { name: "Reload the latest patient record and discard unsaved edits?" })).toBeInTheDocument();
  });
});
