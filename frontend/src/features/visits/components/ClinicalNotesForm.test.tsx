import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "../../../auth/authStore";
import { ClinicalNotesForm } from "./ClinicalNotesForm";

const values = { symptoms: "Pain", diagnosis: "", treatment: "", clinical_notes: "", follow_up_notes: "" };

describe("ClinicalNotesForm", () => {
  afterEach(() => { useAuthStore.setState({ user: null }); });

  it("maps the five supported SOAP-style fields while the action bar owns saving", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ClinicalNotesForm values={values} onChange={onChange} />);
    await user.type(screen.getByLabelText("Assessment"), "Caries");
    expect(onChange).toHaveBeenCalledWith("diagnosis", "C");
    expect(screen.queryByRole("button", { name: "Save notes" })).not.toBeInTheDocument();
  });

  it("uses Arabic field labels in RTL mode", () => {
    useAuthStore.setState({ user: { language_preference: "AR" } as never });
    render(<ClinicalNotesForm values={values} onChange={vi.fn()} />);
    expect(screen.getByRole("textbox", { name: "التقييم" })).toBeInTheDocument();
  });
});
