import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

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
  render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
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

  it("opens the patient detail route from a keyboard-activated row", async () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/staff/patients"]}>
        <PatientTable role="STAFF" patients={[patient]} showArchivedStatus onArchive={vi.fn()} onUnarchive={vi.fn()} />
        <Routes>
          <Route path="/staff/patients" element={null} />
          <Route path="/staff/patients/7" element={<p>Patient detail opened</p>} />
        </Routes>
      </MemoryRouter>,
    );
    screen.getByText("QA Patient").closest("tr")?.focus();
    await userEvent.keyboard("{Enter}");
    expect(screen.getByText("Patient detail opened")).toBeInTheDocument();
  });
});
