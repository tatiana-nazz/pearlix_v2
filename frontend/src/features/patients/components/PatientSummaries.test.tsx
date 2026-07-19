import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";

import type { AppointmentList } from "../../../types/appointments";
import type { VisitDetail } from "../../../types/visits";
import { PatientAppointmentsSummary } from "./PatientAppointmentsSummary";
import { PatientVisitsSummary } from "./PatientVisitsSummary";

const appointment = { id: 4, patient: { id: 9, first_name: "Maya", last_name: "Patient", full_name: "Maya Patient", gender: "Female", date_of_birth: null, age: 30, phone_number: "", email: "", national_id_or_passport: null, blood_group: "", is_archived: false, version: 1, created_at: "2026-07-01T00:00:00Z", updated_at: "2026-07-01T00:00:00Z" }, doctor: { id: 2, full_name: "Dr. Lin", email: "", role: "DOCTOR", is_active: true }, start_datetime: "2026-07-10T09:00:00Z", end_datetime: "2026-07-10T09:30:00Z", duration_minutes: 30, reason: "Cleaning", status: "UPCOMING", reschedule_source_exception: null, reschedule_source_working_shift: null, reschedule_source_type: null, reschedule_source_label: null, reschedule_previous_status: null, created_at: "2026-07-01T00:00:00Z", updated_at: "2026-07-01T00:00:00Z" } as AppointmentList;
const visit = { id: 8, patient: appointment.patient, doctor: appointment.doctor, appointment: { id: appointment.id, start_datetime: appointment.start_datetime, end_datetime: appointment.end_datetime, duration_minutes: appointment.duration_minutes, status: appointment.status, reason: appointment.reason }, status: "COMPLETED", started_at: "2026-07-10T09:00:00Z", completed_at: "2026-07-10T10:00:00Z", diagnosis: "Healthy", treatment: "Cleaning", symptoms: "", clinical_notes: "", follow_up_notes: "", created_at: "2026-07-10T09:00:00Z", updated_at: "2026-07-10T10:00:00Z" } as VisitDetail;
function Location() { const location = useLocation(); return <output data-testid="location">{location.pathname}{location.search}</output>; }

describe("patient summary rows", () => {
  it.each(["ADMIN", "STAFF", "DOCTOR"] as const)("opens the %s appointment workspace from a clickable summary row", (role) => {
    render(<MemoryRouter initialEntries={[`/${role.toLowerCase()}/patients/9?tab=appointments`]}><PatientAppointmentsSummary role={role} appointments={{ count: 1, next: null, previous: null, results: [appointment] }} isLoading={false} error={null} onRetry={() => undefined} /><Location /></MemoryRouter>);
    expect(screen.queryByRole("button", { name: "Appointments" })).not.toBeInTheDocument(); const row = screen.getByRole("link", { name: /Maya Patient/ }); fireEvent.keyDown(row, { key: "Enter" });
    expect(screen.getByTestId("location")).toHaveTextContent(`/${role.toLowerCase()}/appointments/list?date=2026-07-10&appointment=4`);
  });

  it("opens visit details from its row by mouse and Space without an inline action", () => {
    render(<MemoryRouter initialEntries={["/staff/patients/9?tab=visits"]}><PatientVisitsSummary role="STAFF" visits={{ count: 1, next: null, previous: null, results: [visit] }} isLoading={false} error={null} onRetry={() => undefined} /><Location /></MemoryRouter>);
    expect(screen.queryByRole("button", { name: /Open Visit/i })).not.toBeInTheDocument(); const row = screen.getByRole("link", { name: /Dr. Lin/ }); fireEvent.keyDown(row, { key: " " });
    expect(screen.getByTestId("location")).toHaveTextContent("/staff/visits/8");
  });
});
