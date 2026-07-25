import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

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
  it("safely falls back to the readable overview when a Doctor opens the inaccessible billing tab directly", () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/doctor/patients/12?tab=billing"]}>
        <Routes>
          <Route path="/doctor/patients/:patientId" element={<PatientProfilePage role="DOCTOR" />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByRole("tab", { name: "Billing/Handoff" })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", "patient-profile-tab-overview");
    expect(screen.getByText("Contact, demographic, and record metadata.")).toBeInTheDocument();
  });
});
