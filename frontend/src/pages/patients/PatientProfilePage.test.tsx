import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PatientDetail } from "../../types/patients";
import { PatientProfilePage } from "./PatientProfilePage";

const patient = {
  id: 12,
  first_name: "Ava",
  last_name: "Stone",
  full_name: "Ava Stone",
  gender: "Female",
  date_of_birth: "2000-02-29",
  age: 26,
  phone_number: "555-0100",
  email: "ava@example.test",
  national_id_or_passport: null,
  blood_group: "A+",
  is_archived: false,
  version: 4,
  address: "1 Clinic Street",
  emergency_contact: "Sam Stone",
  medical_conditions_history: "",
  insurance_info: "",
  general_notes: "",
  created_by: null,
  updated_by: null,
  created_at: "2026-07-10T08:00:00Z",
  updated_at: "2026-07-10T08:00:00Z",
} satisfies PatientDetail;

const patientQuery = { data: patient, isLoading: false, isError: false, refetch: vi.fn() };
const emptyQuery = { data: undefined, isLoading: false, isError: false, refetch: vi.fn() };
const mutation = { mutateAsync: vi.fn(), reset: vi.fn(), isPending: false, error: null };

vi.mock("../../features/patients/hooks/usePatient", () => ({
  usePatient: vi.fn(() => patientQuery),
  usePatientVisits: vi.fn(() => emptyQuery),
  usePatientAppointments: vi.fn(() => emptyQuery),
  usePatientXrays: vi.fn(() => emptyQuery),
  usePatientAiResults: vi.fn(() => emptyQuery),
}));
vi.mock("../../features/patients/hooks/usePatientMutations", () => ({
  useUpdatePatient: vi.fn(() => mutation),
  useArchivePatient: vi.fn(() => mutation),
  useUnarchivePatient: vi.fn(() => mutation),
}));

describe("PatientProfilePage", () => {
  beforeEach(() => mutation.mutateAsync.mockClear());
  it("opens Staff Edit with loaded values and submits the current version", async () => {
    mutation.mutateAsync.mockResolvedValue(patient);
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/staff/patients/12"]}>
        <Routes><Route path="/staff/patients/:patientId" element={<PatientProfilePage role="STAFF" />} /></Routes>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(await screen.findByRole("heading", { name: "Edit patient" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.querySelector(".patient-identity-rail")).not.toBeInTheDocument();
    expect(screen.getByLabelText(/First name/)).toHaveValue("Ava");
    fireEvent.change(screen.getByLabelText(/First name/), { target: { value: "Avery" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(mutation.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ first_name: "Avery", version: 4 })));
    expect(mutation.mutateAsync.mock.calls[0][0]).not.toHaveProperty("medical_conditions_history");
  });

  it("allows Doctor edit for permitted fields without archive controls", async () => {
    mutation.mutateAsync.mockResolvedValue(patient);
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/doctor/patients/12"]}><Routes><Route path="/doctor/patients/:patientId" element={<PatientProfilePage role="DOCTOR" />} /></Routes></MemoryRouter>);
    expect(screen.queryByRole("button", { name: /Archive|Reactivate/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(await screen.findByLabelText("Phone"), { target: { value: "555-0199" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(mutation.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ phone_number: "555-0199", version: 4 })));
  });

  it("keeps Admin patient detail read-only", () => {
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/admin/patients/12"]}><Routes><Route path="/admin/patients/:patientId" element={<PatientProfilePage role="ADMIN" />} /></Routes></MemoryRouter>);
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Archive|Reactivate/ })).not.toBeInTheDocument();
  });

  it("safely falls back to the readable overview when a Doctor opens the inaccessible billing tab directly", () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/doctor/patients/12?tab=billing"]}>
        <Routes>
          <Route path="/doctor/patients/:patientId" element={<PatientProfilePage role="DOCTOR" />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByRole("tab", { name: "Billing" })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", "patient-profile-tab-overview");
    expect(within(screen.getByRole("tabpanel")).getByText("Contact, demographic, and record metadata.")).toBeInTheDocument();
  });

  it("keeps one desktop identity rail before the scrolling patient content while tabs change", () => {
    const { container } = render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/doctor/patients/12"]}>
        <Routes><Route path="/doctor/patients/:patientId" element={<PatientProfilePage role="DOCTOR" />} /></Routes>
      </MemoryRouter>,
    );
    const rail = container.querySelector(".patient-identity-rail");
    const main = container.querySelector(".patient-detail-main");
    expect(rail).toBeInTheDocument();
    expect(main).toBeInTheDocument();
    expect(rail!.compareDocumentPosition(main!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Medical Summary" }));
    expect(container.querySelector(".patient-identity-rail")).toBe(rail);
    expect(screen.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", "patient-profile-tab-medical");
  });

  it("keeps Edit contextual and normalizes incompatible direct edit queries", async () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/doctor/patients/12?tab=appointments&edit=medical"]}>
        <Routes><Route path="/doctor/patients/:patientId" element={<PatientProfilePage role="DOCTOR" />} /></Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.querySelector(".patient-identity-rail")).toBeInTheDocument();
  });
});
