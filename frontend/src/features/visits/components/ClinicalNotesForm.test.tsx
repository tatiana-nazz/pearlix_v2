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
  it("edits only supported clinical note fields and submits save", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onSave = vi.fn();
    render(<ClinicalNotesForm values={values} onChange={onChange} onSave={onSave} />);

    await user.type(screen.getByLabelText("Diagnosis"), "Caries");
    await user.click(screen.getByRole("button", { name: "Save Notes" }));

    expect(onChange).toHaveBeenCalledWith("diagnosis", "C");
    expect(onSave).toHaveBeenCalledOnce();
  });
});
