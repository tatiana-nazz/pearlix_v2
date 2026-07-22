import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { useAuthStore } from "../../../auth/authStore";
import type { PatientListItem } from "../../../types/patients";
import { PatientTable } from "./PatientTable";

const patient: PatientListItem = {
  id: 7, first_name: "QA", last_name: "Patient", full_name: "QA Patient", gender: "Female", date_of_birth: null, age: 31,
  phone_number: "555-0100", email: "qa@example.test", national_id_or_passport: null, blood_group: "", is_archived: false, version: 77,
  last_visit_with_me_at: "2026-07-10T08:00:00Z", created_at: "2026-07-10T08:00:00Z", updated_at: "2026-07-10T08:00:00Z",
};

function Location() { const location = useLocation(); return <output data-testid="location">{location.pathname}{location.search}</output>; }
function renderTable(role: "ADMIN" | "STAFF" | "DOCTOR", rows: PatientListItem[] = [patient], entry = "/staff/patients?search=qa&page=3") {
  useAuthStore.setState({ user: null, role: null });
  return render(<MemoryRouter initialEntries={[entry]}><PatientTable role={role} patients={rows} /><Location /></MemoryRouter>);
}

describe("PatientTable", () => {
  it("renders backend-derived patient identity, contact, demographic, and visit data without unsupported columns or actions", () => {
    renderTable("STAFF");
    expect(screen.getByRole("columnheader", { name: "Patient" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Contact" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Gender" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Last visit" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Next appointment" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Actions" })).not.toBeInTheDocument();
    expect(screen.getByText("QP")).toHaveClass("patient-initials");
    expect(screen.getByText("QA Patient")).toHaveClass("bidi-isolate");
    expect(screen.getByText("555-0100")).toBeInTheDocument();
    expect(screen.getByText("qa@example.test")).toBeInTheDocument();
    expect(screen.getByRole("row", { name: "QA Patient" })).toHaveTextContent("Female");
    expect(screen.getByRole("row", { name: "QA Patient" })).toHaveTextContent("2026");
    expect(screen.queryByText("Not recorded")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /archive|unarchive|edit|view/i })).not.toBeInTheDocument();
    expect(screen.queryByText("77")).not.toBeInTheDocument();
  });

  it("uses safe localized fallbacks when the list contract omits visit values", () => {
    renderTable("ADMIN", [{ ...patient, last_visit_with_me_at: null, phone_number: "", email: "" }]);
    expect(screen.getAllByText("Not recorded")).toHaveLength(2);
  });

  it.each(["ADMIN", "STAFF", "DOCTOR"] as const)("opens the %s profile on mouse, Enter, and Space while preserving list query state", (role) => {
    const entry = `/${role.toLowerCase()}/patients?search=qa&page=3`;
    renderTable(role, [patient], entry);
    const row = screen.getByRole("row", { name: "QA Patient" });
    fireEvent.click(row);
    expect(screen.getByTestId("location")).toHaveTextContent(`/${role.toLowerCase()}/patients/7?search=qa&page=3`);
    fireEvent.keyDown(row, { key: "Enter" });
    fireEvent.keyDown(row, { key: " " });
    expect(screen.getByTestId("location")).toHaveTextContent(`/${role.toLowerCase()}/patients/7?search=qa&page=3`);
  });

  it("uses the shared table shell styling and localizes Arabic labels in RTL", () => {
    useAuthStore.setState({ user: { language_preference: "AR" } as never, role: "DOCTOR" });
    const { container } = render(<MemoryRouter><PatientTable role="DOCTOR" patients={[patient]} /></MemoryRouter>);
    expect(container.querySelector(".patient-table")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "التواصل" })).toBeInTheDocument();
  });
});
