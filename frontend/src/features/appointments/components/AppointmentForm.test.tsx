import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({ getAppointmentAvailability: vi.fn() }));
vi.mock("../../../api/endpoints/appointments", () => apiMocks);

import { AppointmentForm } from "./AppointmentForm";
import { Modal } from "../../../components/v2";
import type { ValidClinicSafeSettings } from "../hooks/useClinicSafeSettings";

const doctors = [{ id: 7, full_name: "Dr. Lin", email: "lin@example.com", role: "DOCTOR", is_active: true, doctor_profile: { id: 7, specialty: "Orthodontics", phone: "", bio: "", is_active: true } }] as const;
const patients = [{ id: 42, first_name: "Maya", last_name: "Patient", full_name: "Maya Patient", gender: "Female", date_of_birth: null, age: 31, phone_number: "555", email: "", national_id_or_passport: null, blood_group: "", is_archived: false, version: 1, created_at: "", updated_at: "" }] as const;
const settings: ValidClinicSafeSettings = { allowed_durations_minutes: [20, 45], default_appointment_duration_minutes: 45, timezone: "Asia/Damascus", capacity_per_slot: 2 };

function renderForm(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

function setupAvailability() {
  apiMocks.getAppointmentAvailability.mockResolvedValue({ doctor_id: 7, date: "2026-07-10", duration_minutes: 45, capacity_per_slot: 2, available_slots: [
    { start_datetime: "2026-07-10T09:00:00", end_datetime: "2026-07-10T09:45:00", current_count: 1, capacity: 2 },
    { start_datetime: "2026-07-10T10:00:00", end_datetime: "2026-07-10T10:45:00", current_count: 2, capacity: 2 },
  ] });
}

describe("AppointmentForm", () => {
  it("uses configured durations and a live available time for the backend payload", async () => {
    setupAvailability();
    const onSubmit = vi.fn();
    renderForm(<AppointmentForm mode="create" doctors={[...doctors]} patients={[...patients]} settings={settings} initialDate="2026-07-10" initialDoctorId={7} onSubmit={onSubmit} />);

    expect(screen.getByRole("combobox", { name: "Duration" })).toHaveValue("45");
    expect(screen.getByRole("option", { name: "45 minutes" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "30 minutes" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("combobox", { name: "Patient" }));
    await userEvent.click(screen.getByRole("button", { name: /Maya Patient/ }));
    await waitFor(() => expect(screen.getByRole("option", { name: /09:00.*1 spots remaining/ })).toBeInTheDocument());
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Available time" }), "09:00");
    await userEvent.click(screen.getByRole("button", { name: "Save appointment" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ patient_id: 42, doctor_id: 7, start_datetime: "2026-07-10T09:00:00", duration_minutes: 45 })));
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty("status");
    expect(apiMocks.getAppointmentAvailability).toHaveBeenCalledWith({ doctor_id: 7, date: "2026-07-10", duration_minutes: 45 });
  });

  it("keeps the Patient search as a readable searchable choice without raw IDs", async () => {
    setupAvailability();
    renderForm(<AppointmentForm mode="create" doctors={[...doctors]} patients={[...patients]} settings={settings} initialDate="2026-07-10" initialDoctorId={7} onSubmit={vi.fn()} />);
    const patient = screen.getByRole("combobox", { name: "Patient" });
    await userEvent.type(patient, "Maya");
    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(patient).toHaveValue("Maya Patient · 555");
    expect(patient).not.toHaveValue("42");
  });

  it("excludes inactive doctors while preserving the current inactive doctor in edit mode", () => {
    const inactive = { ...doctors[0], is_active: false, full_name: "Dr. Retired" };
    const appointment = { id: 5, patient: patients[0], doctor: { id: 7, full_name: "Dr. Retired", email: "", role: "DOCTOR", is_active: false, theme_preference: "SYSTEM", language_preference: "EN" }, start_datetime: "2026-07-10T09:00:00", end_datetime: "2026-07-10T09:45:00", duration_minutes: 45, reason: "", notes: "", status: "UPCOMING", reschedule_source_exception: null, reschedule_source_working_shift: null, reschedule_source_type: null, reschedule_source_label: null, reschedule_previous_status: null, created_at: "", updated_at: "", created_by: null, updated_by: null } as const;
    renderForm(<AppointmentForm mode="edit" doctors={[inactive]} patients={[...patients]} settings={settings} appointment={appointment} onSubmit={vi.fn()} />);
    expect(screen.getByRole("option", { name: /Dr. Retired.*Current inactive doctor/ })).toBeInTheDocument();
  });

  it("blocks submission when clinic settings are unavailable", async () => {
    const onSubmit = vi.fn();
    renderForm(<AppointmentForm mode="create" doctors={[...doctors]} patients={[...patients]} settingsError={new Error("down")} onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole("button", { name: "Save appointment" }));
    expect(screen.getByText("Clinic settings are unavailable.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("only asks to discard after a production form field changes", async () => {
    setupAvailability();
    function Example() {
      const [open, setOpen] = useState(true); const [dirty, setDirty] = useState(false);
      return <Modal open={open} title="Add Appointment" dirty={dirty} onClose={() => setOpen(false)}><AppointmentForm mode="create" doctors={[...doctors]} patients={[...patients]} settings={settings} initialDate="2026-07-10" initialDoctorId={7} onDirtyChange={setDirty} onSubmit={vi.fn()} /></Modal>;
    }
    renderForm(<Example />);
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("shows discard confirmation after an edited production form is closed", async () => {
    setupAvailability();
    function Example() {
      const [dirty, setDirty] = useState(false);
      return <Modal open title="Add Appointment" dirty={dirty} onClose={vi.fn()}><AppointmentForm mode="create" doctors={[...doctors]} patients={[...patients]} settings={settings} initialDate="2026-07-10" initialDoctorId={7} onDirtyChange={setDirty} onSubmit={vi.fn()} /></Modal>;
    }
    renderForm(<Example />);
    await userEvent.type(screen.getByRole("textbox", { name: "Reason" }), "Cleaning");
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });
});
