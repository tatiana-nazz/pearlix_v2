import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
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

function Location() { const location = useLocation(); return <output data-testid="location">{location.pathname}{location.search}</output>; }

function renderPage(role: "ADMIN" | "STAFF" | "DOCTOR" = "STAFF", entry = "/staff/patients/9") {
  const path = `/${role.toLowerCase()}/patients/:patientId`;
  return render(<MemoryRouter initialEntries={[entry]}><Routes><Route path={path} element={<><PatientProfilePage role={role} defaultTab={role === "DOCTOR" ? "visits" : "overview"} /><Location /></>} /><Route path={`/${role.toLowerCase()}/patients`} element={<Location />} /></Routes></MemoryRouter>);
}

function mockPage(refetch: ReturnType<typeof vi.fn>, reset = vi.fn(), updateError: unknown = new ApiClientError({ code: "VERSION_CONFLICT", message: "Changed elsewhere", details: {}, status: 409 })) {
  vi.mocked(patientHooks.usePatient).mockReturnValue({ data: patient, isLoading: false, isError: false, error: null, refetch } as never);
  vi.mocked(patientHooks.usePatientVisits).mockReturnValue(idleQuery as never);
  vi.mocked(patientHooks.usePatientAppointments).mockReturnValue(idleQuery as never);
  vi.mocked(patientHooks.usePatientXrays).mockReturnValue(idleQuery as never);
  vi.mocked(patientHooks.usePatientAiResults).mockReturnValue(idleQuery as never);
  vi.mocked(patientMutations.useUpdatePatient).mockReturnValue({ isPending: false, error: updateError, reset, mutateAsync: vi.fn() } as never);
  vi.mocked(patientMutations.useArchivePatient).mockReturnValue({ isPending: false, error: null, reset: vi.fn(), mutateAsync: vi.fn() } as never);
  vi.mocked(patientMutations.useUnarchivePatient).mockReturnValue({ isPending: false, error: null, reset: vi.fn(), mutateAsync: vi.fn() } as never);
  return reset;
}

describe("Patient profile production route", () => {
  it("returns through Back to the preserved list search, filter, and page state", () => {
    mockPage(vi.fn());
    renderPage("STAFF", "/staff/patients/9?search=nour&archive=archived&page=3");
    fireEvent.click(screen.getByRole("link", { name: "Back to patients" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/staff/patients?search=nour&archive=archived&page=3");
  });

  it("keeps Admin read-only, gives Doctor editing without billing or archive controls, and locks archived records", () => {
    mockPage(vi.fn());
    const admin = renderPage("ADMIN", "/admin/patients/9?tab=billing");
    expect(screen.queryByRole("button", { name: "Edit Patient" })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Billing / Handoff" })).toHaveAttribute("aria-selected", "true");
    admin.unmount();
    mockPage(vi.fn());
    const doctor = renderPage("DOCTOR", "/doctor/patients/9?tab=visits");
    expect(screen.getByRole("button", { name: "Edit Patient" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Billing / Handoff" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Archive patient/ })).not.toBeInTheDocument();
    doctor.unmount();
    mockPage(vi.fn());
    vi.mocked(patientHooks.usePatient).mockReturnValue({ data: { ...patient, is_archived: true }, isLoading: false, isError: false, error: null, refetch: vi.fn() } as never);
    renderPage();
    expect(screen.queryByRole("button", { name: "Edit Patient" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unarchive patient" })).toBeInTheDocument();
  });

  it("handles invalid, loading, retryable error, and missing patient states", () => {
    mockPage(vi.fn());
    const invalid = render(<MemoryRouter initialEntries={["/staff/patients/nope"]}><Routes><Route path="/staff/patients/:patientId" element={<PatientProfilePage role="STAFF" />} /></Routes></MemoryRouter>);
    expect(screen.getByText("Patient was not found.")).toBeInTheDocument();
    invalid.unmount();
    mockPage(vi.fn());
    vi.mocked(patientHooks.usePatient).mockReturnValue({ data: undefined, isLoading: true, isError: false, error: null, refetch: vi.fn() } as never);
    const loading = renderPage();
    expect(screen.getByText("Loading patient profile…")).toBeInTheDocument();
    loading.unmount();
    const retry = vi.fn();
    mockPage(retry);
    vi.mocked(patientHooks.usePatient).mockReturnValue({ data: undefined, isLoading: false, isError: true, error: new Error("Unavailable"), refetch: retry } as never);
    const error = renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalledTimes(1);
    error.unmount();
    mockPage(vi.fn());
    vi.mocked(patientHooks.usePatient).mockReturnValue({ data: undefined, isLoading: false, isError: false, error: null, refetch: vi.fn() } as never);
    renderPage();
    expect(screen.getByText("Patient was not found or is unavailable to this role.")).toBeInTheDocument();
  });

  it("preserves query parameters around edit, sends the exact versioned update, and restores the Edit trigger", async () => {
    const update = vi.fn().mockResolvedValue(patient);
    mockPage(vi.fn());
    vi.mocked(patientMutations.useUpdatePatient).mockReturnValue({ isPending: false, error: null, reset: vi.fn(), mutateAsync: update } as never);
    renderPage("STAFF", "/staff/patients/9?tab=medical&keep=value");
    const trigger = screen.getByRole("button", { name: "Edit Patient" });
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByTestId("location")).toHaveTextContent("tab=medical");
    expect(screen.getByTestId("location")).toHaveTextContent("keep=value");
    const firstName = document.querySelector<HTMLInputElement>("#edit-patient-first-name")!;
    expect(firstName).toHaveValue("Nour");
    fireEvent.change(firstName, { target: { value: "Noura" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(update).toHaveBeenCalledWith(expect.objectContaining({ first_name: "Noura", last_name: "Haddad", version: 3 })));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Edit Patient" })).not.toBeInTheDocument());
    expect(screen.getByTestId("location")).toHaveTextContent("tab=medical");
    expect(screen.getByTestId("location")).toHaveTextContent("keep=value");
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("retains failed update values and maps representative API field errors without clearing dirty state", async () => {
    const error = new ApiClientError({ code: "VALIDATION_ERROR", message: "Invalid", details: { phone_number: ["already exists"], email: ["invalid"] }, status: 400 });
    const update = vi.fn().mockRejectedValue(error);
    mockPage(vi.fn());
    vi.mocked(patientMutations.useUpdatePatient).mockImplementation(() => ({ isPending: false, error: update.mock.calls.length ? error : null, reset: vi.fn(), mutateAsync: update }) as never);
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Edit Patient" }));
    const phone = screen.getByLabelText("Phone");
    fireEvent.change(phone, { target: { value: "+963 22" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect(phone).toHaveValue("+963 22");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(await screen.findByRole("alertdialog", { name: "Discard unsaved changes?" })).toBeInTheDocument();
  });

  it.each([
    ["phone_number", "Phone", "+963 22", "already exists"],
    ["email", "Email", "noura@example.test", "already exists"],
  ] as const)("maps the %s API error through the production edit form", (field, label, value, message) => {
    const error = new ApiClientError({ code: "VALIDATION_ERROR", message: "Invalid", details: { [field]: ["already exists"] }, status: 400 });
    mockPage(vi.fn(), vi.fn(), error);
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Edit Patient" }));
    const input = screen.getByLabelText(new RegExp(`^${label}`));
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText(message)).toBeInTheDocument();
    fireEvent.change(input, { target: { value } });
    expect(input).toHaveAttribute("aria-invalid", "false");
  });

  it("blocks edit closure while a versioned update is pending", async () => {
    let finish: () => void = () => undefined;
    const update = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    mockPage(vi.fn());
    vi.mocked(patientMutations.useUpdatePatient).mockReturnValue({ isPending: true, error: null, reset: vi.fn(), mutateAsync: update } as never);
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Edit Patient" }));
    expect(screen.getByRole("button", { name: "Close" })).toBeDisabled();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("dialog", { name: "Edit Patient" })).toBeInTheDocument();
    finish();
  });

  it("keeps edits when Continue reviewing clears only a version conflict, and Escape closes only Reload Latest", async () => {
    const reset = mockPage(vi.fn());
    const first = renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Edit Patient" }));
    const firstName = document.querySelector<HTMLInputElement>("#edit-patient-first-name")!;
    fireEvent.change(firstName, { target: { value: "Noura" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue reviewing my changes" }));
    expect(reset).toHaveBeenCalledTimes(1);
    expect(firstName).toHaveValue("Noura");

    // Re-open with the conflict prompt, then ensure its Escape does not close the edit overlay.
    first.unmount();
    mockPage(vi.fn());
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Edit Patient" }));
    fireEvent.click(screen.getByRole("button", { name: "Reload latest record" }));
    await screen.findByRole("alertdialog", { name: "Reload the latest patient record and discard unsaved edits?" });
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    const editDialogs = screen.getAllByRole("dialog", { name: "Edit Patient" });
    expect(editDialogs[editDialogs.length - 1]).toBeInTheDocument();
  });
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
