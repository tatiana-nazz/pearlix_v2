import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ApiClientError } from "../../../api/errors";
import { PatientForm } from "./PatientForm";

describe("PatientForm", () => {
  it("shows required field errors", async () => {
    const onSubmit = vi.fn();
    render(<PatientForm mode="create" role="STAFF" onSubmit={onSubmit} />);

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

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

    expect(screen.getByText(/Doctors can update active patient profiles/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Archived/)).not.toBeInTheDocument();
  });

  it("clears the conflict banner while preserving entered form values", async () => {
    const error = new ApiClientError({ code: "VERSION_CONFLICT", message: "Conflict", details: {}, status: 409 });
    const onContinueReviewing = vi.fn();
    render(<PatientForm mode="create" role="STAFF" error={error} onSubmit={vi.fn()} onContinueReviewing={onContinueReviewing} />);
    await userEvent.type(screen.getByLabelText(/First name/), "Maya");
    await userEvent.click(screen.getByRole("button", { name: "Continue reviewing my changes" }));
    expect(screen.queryByText(/changed elsewhere/)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/First name/)).toHaveValue("Maya");
    expect(onContinueReviewing).toHaveBeenCalledOnce();
  });
});
