import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ApiClientError } from "../../../api/errors";
import { PatientForm } from "./PatientForm";

describe("PatientForm", () => {
  it("shows required field errors", async () => {
    const onSubmit = vi.fn();
    render(<PatientForm mode="create" role="STAFF" onSubmit={onSubmit} />);

    await userEvent.click(screen.getByRole("button", { name: "Save patient" }));

    expect(await screen.findByText("First name is required.")).toBeInTheDocument();
    expect(screen.getByText("Last name is required.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("maps backend field errors and preserves values", () => {
    const error = new ApiClientError({
      code: "VALIDATION_ERROR",
      message: "Some fields are invalid.",
      details: { phone_number: ["Phone number is invalid."] },
      status: 400,
    });

    render(<PatientForm mode="create" role="STAFF" error={error} onSubmit={vi.fn()} />);

    expect(screen.getByText("Phone number is invalid.")).toBeInTheDocument();
    expect(screen.getByLabelText(/First name/)).toHaveValue("");
  });

  it("renders Doctor note without archive fields", () => {
    render(<PatientForm mode="create" role="DOCTOR" onSubmit={vi.fn()} />);

    expect(screen.getByText(/Doctors can update patient profile fields/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Archived/)).not.toBeInTheDocument();
  });

  it("keeps medical-history fields out of the General Information creation form", () => {
    render(<PatientForm mode="create" role="STAFF" onSubmit={vi.fn()} />);
    expect(screen.queryByLabelText("Medical conditions history")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Insurance information")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("General notes")).not.toBeInTheDocument();
  });

  it("submits the exact patient payload without a derived age", async () => {
    const onSubmit = vi.fn();
    render(<PatientForm mode="create" role="STAFF" onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText(/First name/), "Maya");
    await userEvent.type(screen.getByLabelText(/Last name/), "Haddad");
    await userEvent.selectOptions(screen.getByLabelText(/Gender/), "Female");
    await userEvent.selectOptions(screen.getByLabelText("Blood group"), "A+");
    await userEvent.click(screen.getByRole("button", { name: "Save patient" }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ first_name: "Maya", last_name: "Haddad", gender: "Female", blood_group: "A+" }));
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty("age");
  });

  it("asks before discarding a dirty form", async () => {
    const onCancel = vi.fn();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<PatientForm mode="create" role="STAFF" onSubmit={vi.fn()} onCancel={onCancel} />);
    await userEvent.type(screen.getByLabelText(/First name/), "Maya");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(confirm).toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
    confirm.mockRestore();
  });
});
