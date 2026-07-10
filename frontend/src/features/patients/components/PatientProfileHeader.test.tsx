import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { PatientDetail } from "../../../types/patients";
import { PatientProfileHeader } from "./PatientProfileHeader";

const patient: PatientDetail = {
  id: 9,
  full_name: "QA Profile",
  phone: "555",
  gender: "UNSPECIFIED",
  birth_date: null,
  age: null,
  address: "",
  medical_summary: "",
  general_notes: "",
  is_archived: false,
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
