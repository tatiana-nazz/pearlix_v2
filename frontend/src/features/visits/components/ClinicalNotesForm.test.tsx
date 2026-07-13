import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "../../../auth/authStore";
import { ClinicalNotesForm } from "./ClinicalNotesForm";

const values = {
  symptoms: "Pain",
  diagnosis: "",
  treatment: "",
  clinical_notes: "",
  follow_up_notes: "",
};

describe("ClinicalNotesForm", () => {
  afterEach(() => { useAuthStore.setState({ user: null }); });

  it("maps all five supported fields and submits the save lifecycle", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onSave = vi.fn();
    render(<ClinicalNotesForm values={values} onChange={onChange} onSave={onSave} />);

    await user.type(screen.getByLabelText("Diagnosis"), "Caries");
    await user.click(screen.getByRole("button", { name: "Save notes" }));

    expect(onChange).toHaveBeenCalledWith("diagnosis", "C");
    expect(onSave).toHaveBeenCalledOnce();
  });

  it("uses Arabic field labels when the clinic is in RTL mode", () => {
    useAuthStore.setState({ user: { language_preference: "AR" } as never });
    render(<ClinicalNotesForm values={values} onChange={vi.fn()} onSave={vi.fn()} />);

    expect(screen.getByRole("textbox", { name: "الأعراض" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "حفظ الملاحظات" })).toBeInTheDocument();
  });
});
