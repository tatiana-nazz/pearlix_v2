import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { useAuthStore } from "../../../auth/authStore";

import type { PatientListItem } from "../../../types/patients";
import { PatientTable } from "./PatientTable";

const patient: PatientListItem = {
  id: 7,
  first_name: "QA",
  last_name: "Patient",
  full_name: "QA Patient",
  gender: "Female",
  date_of_birth: null,
  age: null,
  phone_number: "555-0100",
  email: "",
  national_id_or_passport: null,
  blood_group: "",
  is_archived: false,
  version: 1,
  created_at: "2026-07-10T08:00:00Z",
  updated_at: "2026-07-10T08:00:00Z",
};

function renderTable(role: "ADMIN" | "STAFF" | "DOCTOR", rows: PatientListItem[] = [patient]) {
  useAuthStore.setState({ user: null, role: null });
  render(
    <MemoryRouter>
      <PatientTable role={role} patients={rows} showArchivedStatus={role !== "DOCTOR"} onArchive={vi.fn()} onUnarchive={vi.fn()} />
    </MemoryRouter>,
  );
}

describe("PatientTable", () => {
  it("renders empty state", () => {
    renderTable("STAFF", []);
    expect(screen.getByText("No patients found for this filter.")).toBeInTheDocument();
  });

  it("opens the Admin row without a routine View control", () => {
    renderTable("ADMIN");
    expect(screen.getByRole("row", { name: /QA Patient/ })).toHaveAttribute("tabindex", "0");
    expect(screen.queryByRole("link", { name: "View" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Edit Patient" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Archive patient" })).not.toBeInTheDocument();
  });

  it("renders Staff edit and archive actions", () => {
    renderTable("STAFF");
    expect(screen.getByRole("link", { name: "Edit Patient" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Archive patient" })).toBeInTheDocument();
  });

  it("renders Doctor edit but no archive action", () => {
    renderTable("DOCTOR");
    expect(screen.getByRole("link", { name: "Edit Patient" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Archive patient" })).not.toBeInTheDocument();
    expect(screen.queryByText("Status")).not.toBeInTheDocument();
  });

  it("renders age zero and never exposes the optimistic-lock version", () => {
    renderTable("STAFF", [{ ...patient, age: 0, version: 77 }]);
    expect(screen.getByRole("row", { name: /0 years old/ })).toBeInTheDocument();
    expect(screen.queryByText("77")).not.toBeInTheDocument();
  });
});
