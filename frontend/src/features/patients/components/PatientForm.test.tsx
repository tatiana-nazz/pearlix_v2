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

    expect(await screen.findByText("Full name is required.")).toBeInTheDocument();
    expect(screen.getByText("Phone is required.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("maps backend field errors and preserves values", () => {
    const error = new ApiClientError({
      code: "VALIDATION_ERROR",
      message: "Some fields are invalid.",
      details: { phone: ["Phone is required."] },
      status: 400,
    });

    render(<PatientForm mode="create" role="STAFF" error={error} onSubmit={vi.fn()} />);

    expect(screen.getByText("Phone is required.")).toBeInTheDocument();
    expect(screen.getByLabelText(/Full name/)).toHaveValue("");
  });

  it("renders Doctor note without archive fields", () => {
    render(<PatientForm mode="create" role="DOCTOR" onSubmit={vi.fn()} />);

    expect(screen.getByText(/Doctors can update patient profile fields/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Archived/)).not.toBeInTheDocument();
  });
});
