import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AppointmentForm } from "./AppointmentForm";
import { Modal } from "../../../components/v2";
import { useState } from "react";

const doctors = [{ id: 7, full_name: "Dr. Lin", email: "lin@example.com", role: "DOCTOR", is_active: true, doctor_profile: null }] as const;
const patients = [{ id: 42, first_name: "Maya", last_name: "Patient", full_name: "Maya Patient", gender: "Female", date_of_birth: null, age: 31, phone_number: "555", email: "", national_id_or_passport: null, blood_group: "", is_archived: false, version: 1, created_at: "", updated_at: "" }] as const;

describe("AppointmentForm", () => {
  it("validates required fields", async () => {
    const onSubmit = vi.fn();
    render(<AppointmentForm mode="create" doctors={[...doctors]} patients={[...patients]} onSubmit={onSubmit} />);

    await userEvent.click(screen.getByRole("button", { name: "Save appointment" }));

    expect(await screen.findByText("Patient is required.")).toBeInTheDocument();
    expect(screen.getByText("Doctor is required.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits supported backend payload without status", async () => {
    const onSubmit = vi.fn();
    render(<AppointmentForm mode="create" doctors={[...doctors]} patients={[...patients]} initialDate="2026-07-10" initialDoctorId={7} onSubmit={onSubmit} />);

    await userEvent.click(screen.getByRole("combobox", { name: "Patient" }));
    await userEvent.click(screen.getByRole("button", { name: /Maya Patient/ }));
    await userEvent.click(screen.getByRole("button", { name: "Save appointment" }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ patient_id: 42, doctor_id: 7, start_datetime: "2026-07-10T09:00:00" }));
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty("status");
  });

  it("uses a readable, keyboard-selectable patient combobox with an associated field error", async () => {
    render(<AppointmentForm mode="create" doctors={[...doctors]} patients={[...patients]} initialDate="2026-07-10" initialDoctorId={7} onSubmit={vi.fn()} />);
    const patient = screen.getByRole("combobox", { name: "Patient" });
    await userEvent.click(screen.getByRole("button", { name: "Save appointment" }));
    expect(patient).toHaveAttribute("aria-describedby");
    await userEvent.type(patient, "Maya");
    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(patient).toHaveValue("Maya Patient · 555");
    expect(patient).not.toHaveValue("42");
  });

  it("only asks to discard after a production form field changes", async () => {
    function Example() {
      const [open, setOpen] = useState(true); const [dirty, setDirty] = useState(false);
      return <Modal open={open} title="Add Appointment" dirty={dirty} onClose={() => setOpen(false)}><AppointmentForm mode="create" doctors={[...doctors]} patients={[...patients]} initialDate="2026-07-10" initialDoctorId={7} onDirtyChange={setDirty} onSubmit={vi.fn()} /></Modal>;
    }
    render(<Example />);
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows discard confirmation after an edited production form is closed", async () => {
    function Example() {
      const [dirty, setDirty] = useState(false);
      return <Modal open title="Add Appointment" dirty={dirty} onClose={vi.fn()}><AppointmentForm mode="create" doctors={[...doctors]} patients={[...patients]} initialDate="2026-07-10" initialDoctorId={7} onDirtyChange={setDirty} onSubmit={vi.fn()} /></Modal>;
    }
    render(<Example />);
    await userEvent.type(screen.getByRole("textbox", { name: "Reason" }), "Cleaning");
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("clears a stale selected patient ID when the visible query is replaced", async () => {
    const onSubmit = vi.fn();
    render(<AppointmentForm mode="create" doctors={[...doctors]} patients={[...patients]} initialDate="2026-07-10" initialDoctorId={7} onSubmit={onSubmit} />);
    const patient = screen.getByRole("combobox", { name: "Patient" });
    await userEvent.click(patient); await userEvent.click(screen.getByRole("button", { name: /Maya Patient/ }));
    await userEvent.clear(patient); await userEvent.type(patient, "Unrelated patient");
    await userEvent.click(screen.getByRole("button", { name: "Save appointment" }));
    expect(await screen.findByText("Patient is required.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
