import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AppointmentForm } from "./AppointmentForm";

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
});
