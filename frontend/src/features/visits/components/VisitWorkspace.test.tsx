import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "../../../auth/authStore";
import type { VisitDetail } from "../../../types/visits";
import { VisitWorkspace } from "./VisitWorkspace";

vi.mock("../../patients/hooks/usePatient", () => ({
  usePatient: () => ({ isLoading: false, isError: false, data: { phone_number: "555-0100", blood_group: "O+", insurance_info: "Clinic plan", medical_conditions_history: "Penicillin allergy" } }),
}));
vi.mock("../../xrays/components/VisitXraySection", () => ({ VisitXraySection: () => <p>Attachment panel</p> }));
vi.mock("../../billing/components/VisitBillingSection", () => ({ VisitBillingSection: () => <p>Billing panel</p> }));

const visit = {
  id: 91,
  appointment: { id: 17, start_datetime: "2026-07-26T09:00:00Z", end_datetime: "2026-07-26T09:30:00Z", duration_minutes: 30, status: "CHECKED_IN", reason: "Review" },
  patient: { id: 44, first_name: "Ada", last_name: "Lovelace", full_name: "Ada Lovelace", gender: "Female", date_of_birth: "1985-01-01", age: 41, phone_number: "555-0100", email: "ada@example.test", national_id_or_passport: null, blood_group: "O+", is_archived: false, version: 1, created_at: "2026-01-01", updated_at: "2026-01-01" },
  doctor: { id: 7, full_name: "Doctor One", email: "doctor@example.test", role: "DOCTOR" },
  status: "ACTIVE", started_at: "2026-07-26T09:01:00Z", completed_at: null, symptoms: "Pain", diagnosis: "Caries", treatment: "Cleaning", clinical_notes: "Stable", follow_up_notes: "Review in six months", created_at: "2026-07-26", updated_at: "2026-07-26",
} as VisitDetail;

function renderWorkspace(role: "DOCTOR" | "STAFF" | "ADMIN" = "DOCTOR") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter><VisitWorkspace role={role} visit={visit} /></MemoryRouter></QueryClientProvider>);
}

function setUser(role: "DOCTOR" | "STAFF" | "ADMIN", language_preference: "EN" | "AR" = "EN") {
  useAuthStore.setState({ user: { id: role === "DOCTOR" ? 7 : 8, full_name: "Workspace User", email: "user@example.test", role, is_active: true, must_change_password: false, password_changed_at: null, theme_preference: "LIGHT", language_preference } });
}

describe("VisitWorkspace", () => {
  beforeEach(() => setUser("DOCTOR"));

  it("uses the patient identity and exposes one accessible tab level", () => {
    renderWorkspace();
    expect(screen.getByRole("heading", { name: "Ada Lovelace" })).toBeInTheDocument();
    expect(screen.queryByText("Visit #91")).not.toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(4);
    expect(screen.getByRole("tab", { name: "Visit Notes" })).toHaveAttribute("aria-selected", "true");
  });

  it("keeps the patient context read-first and opens it with keyboard tabs", () => {
    renderWorkspace();
    const notes = screen.getByRole("tab", { name: "Visit Notes" });
    fireEvent.keyDown(notes, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Patient Profile" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Penicillin allergy")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open full patient profile" })).toBeInTheDocument();
    expect(screen.queryByText(/archive|reactivate/i)).not.toBeInTheDocument();
  });

  it("protects clinical editing and completion for a non-owning Staff user", () => {
    setUser("STAFF");
    renderWorkspace("STAFF");
    expect(screen.getByText("Clinical notes are read-only for your role and this visit.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save Notes" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Complete Visit" })).not.toBeInTheDocument();
    expect(screen.queryByText(/payment/i)).not.toBeInTheDocument();
  });

  it("localizes critical tab copy in Arabic", () => {
    setUser("DOCTOR", "AR");
    renderWorkspace();
    expect(screen.getByRole("tab", { name: "ملاحظات الزيارة" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "حفظ الملاحظات" })).toBeInTheDocument();
  });
});
