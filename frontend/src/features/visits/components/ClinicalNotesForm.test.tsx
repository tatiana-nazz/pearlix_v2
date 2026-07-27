import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ClinicalNotesForm } from "./ClinicalNotesForm";

const values = {
  symptoms: "Pain",
  diagnosis: "",
  treatment: "",
  clinical_notes: "",
  follow_up_notes: "",
};

describe("ClinicalNotesForm", () => {
  it("maps the five supported backend fields to the specified clinical sections", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ClinicalNotesForm values={values} onChange={onChange} />);

    expect(screen.getByLabelText("Subjective Notes")).toHaveValue("Pain");
    expect(screen.getByLabelText("Objective Notes")).toBeInTheDocument();
    expect(screen.getByLabelText("Assessment")).toBeInTheDocument();
    expect(screen.getByLabelText("Plan")).toBeInTheDocument();
    expect(screen.getByLabelText("General Notes")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save Notes" })).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Assessment"), "Caries");

    expect(onChange).toHaveBeenCalledWith("diagnosis", "C");
  });
});
