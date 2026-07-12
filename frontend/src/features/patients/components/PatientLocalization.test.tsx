import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "../../../auth/authStore";
import type { PatientDetail } from "../../../types/patients";
import { PatientFilters } from "./PatientFilters";
import { PatientProfileHeader } from "./PatientProfileHeader";
import { PatientProfileTabs } from "./PatientProfileTabs";

const patient: PatientDetail = { id: 9, first_name: "Nour", last_name: "Haddad", full_name: "Nour Haddad", gender: "Female", date_of_birth: "1994-01-01", age: 32, phone_number: "555-0100", email: "nour@example.test", national_id_or_passport: "A-123", address: "Damascus", emergency_contact: "555-0199", blood_group: "A+", medical_conditions_history: "", insurance_info: "", general_notes: "", is_archived: false, version: 1, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z", created_by: null, updated_by: null };

describe("Phase 14D patient localization and RTL", () => {
  afterEach(() => useAuthStore.setState({ user: null, role: null }));
  it("localizes patient list filters and keeps Doctor archive filtering absent", () => {
    useAuthStore.setState({ user: { id: 1, email: "d@example.test", full_name: "Dr Noor", role: "DOCTOR", is_active: true, must_change_password: false, password_changed_at: null, theme_preference: "LIGHT", language_preference: "AR" }, role: "DOCTOR" });
    render(<PatientFilters role="DOCTOR" search="" archiveFilter="active" doctorFilter="all" onSearchChange={vi.fn()} onArchiveFilterChange={vi.fn()} onDoctorFilterChange={vi.fn()} />);
    expect(screen.getByLabelText("بحث عن المرضى")).toBeInTheDocument();
    expect(screen.queryByText("حالة الأرشفة")).not.toBeInTheDocument();
  });
  it("uses localized profile tabs and hides billing for Doctor", () => {
    useAuthStore.setState({ user: { id: 1, email: "d@example.test", full_name: "Dr Noor", role: "DOCTOR", is_active: true, must_change_password: false, password_changed_at: null, theme_preference: "LIGHT", language_preference: "AR" }, role: "DOCTOR" });
    render(<PatientProfileTabs role="DOCTOR" activeTab="overview" onTabChange={vi.fn()} />);
    expect(screen.getByRole("tab", { name: "نظرة عامة" })).toBeInTheDocument();
    expect(screen.queryByText("الفوترة / التحويل")).not.toBeInTheDocument();
  });
  it("keeps patient contact values bidi-isolated and Doctor archive controls absent", () => {
    render(<MemoryRouter><PatientProfileHeader role="DOCTOR" patient={patient} onEdit={vi.fn()} onArchive={vi.fn()} onUnarchive={vi.fn()} /></MemoryRouter>);
    expect(screen.getByText("555-0100")).toHaveClass("bidi-isolate");
    expect(screen.queryByRole("button", { name: /archive/i })).not.toBeInTheDocument();
  });
});
