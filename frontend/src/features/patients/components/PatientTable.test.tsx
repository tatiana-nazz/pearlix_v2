import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import type { PatientListItem } from "../../../types/patients";
import { PatientTable } from "./PatientTable";

const patient: PatientListItem = {
  id: 7,
  full_name: "QA Patient",
  phone: "555-0100",
  gender: "UNSPECIFIED",
  birth_date: null,
  age: null,
  is_archived: false,
  created_at: "2026-07-10T08:00:00Z",
  updated_at: "2026-07-10T08:00:00Z",
};

function renderTable(role: "ADMIN" | "STAFF" | "DOCTOR", rows: PatientListItem[] = [patient]) {
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

  it("renders Admin row with View only", () => {
    renderTable("ADMIN");
    expect(screen.getByRole("link", { name: "View" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Archive" })).not.toBeInTheDocument();
  });

  it("renders Staff edit and archive actions", () => {
    renderTable("STAFF");
    expect(screen.getByRole("link", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Archive" })).toBeInTheDocument();
  });

  it("renders Doctor edit but no archive action", () => {
    renderTable("DOCTOR");
    expect(screen.getByRole("link", { name: "Edit" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Archive" })).not.toBeInTheDocument();
    expect(screen.queryByText("Status")).not.toBeInTheDocument();
  });
});
