import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { PatientDetail } from "../../../types/patients";
import { PatientProfileHeader } from "./PatientProfileHeader";

const patient: PatientDetail = {
  id: 9,
  first_name: "QA",
  last_name: "Profile",
  full_name: "QA Profile",
  gender: "Female",
  date_of_birth: null,
  age: null,
  phone_number: "555",
  email: "",
  national_id_or_passport: null,
  blood_group: "",
  address: "",
  emergency_contact: "",
  medical_conditions_history: "",
  insurance_info: "",
  general_notes: "",
  is_archived: false,
  version: 1,
  created_at: "2026-07-10T08:00:00Z",
  updated_at: "2026-07-10T08:00:00Z",
  created_by: null,
  updated_by: null,
};

describe("PatientProfileHeader", () => {
  it("keeps Admin read-only", () => {
    render(<PatientProfileHeader role="ADMIN" patient={patient} onEdit={vi.fn()} onArchive={vi.fn()} onUnarchive={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Archive Patient" })).not.toBeInTheDocument();
  });

  it("shows Staff actions", () => {
    render(<PatientProfileHeader role="STAFF" patient={patient} onEdit={vi.fn()} onArchive={vi.fn()} onUnarchive={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Archive Patient" })).toBeInTheDocument();
  });

  it("does not show Doctor archive controls", () => {
    render(<PatientProfileHeader role="DOCTOR" patient={patient} onEdit={vi.fn()} onArchive={vi.fn()} onUnarchive={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Archive Patient" })).not.toBeInTheDocument();
  });
});
