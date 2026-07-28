import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import * as patientApi from "../../../api/endpoints/patients";
import { useAuthStore } from "../../../auth/authStore";
import type { AuthUser } from "../../../types/auth";
import type { ExternalXrayCase } from "../../../types/xrays";
import { AttachExternalXrayDialog, DiscardExternalXrayDialog } from "./ExternalXrayDialogs";

vi.mock("../../patients/hooks/usePatient", () => ({ usePatientVisits: () => ({ data: { results: [{ id: 8, doctor: { id: 2 }, started_at: "2026-07-20T09:00:00Z", status: "ACTIVE" }] }, isLoading: false, isError: false, refetch: vi.fn() }) }));

const external = { id: 4, title: "External", original_file_name: "external.png" } as ExternalXrayCase;
const doctor: AuthUser = { id: 2, full_name: "Dr. Lin", email: "doctor@example.test", role: "DOCTOR", is_active: true, theme_preference: "LIGHT", language_preference: "EN", must_change_password: false, password_changed_at: null };

describe("External X-ray production dialogs", () => {
  afterEach(() => { vi.restoreAllMocks(); useAuthStore.setState({ user: null }); });

  it("uses controlled active-patient search, resets the visit, and sends the exact attach payload", async () => {
    useAuthStore.setState({ user: doctor });
    vi.spyOn(patientApi, "getPatients").mockResolvedValue({ count: 2, next: null, previous: null, results: [
      { id: 3, full_name: "Active Patient", is_archived: false }, { id: 4, full_name: "Archived Patient", is_archived: true },
    ] } as never);
    const submit = vi.fn();
    render(<AttachExternalXrayDialog external={external} isSubmitting={false} onCancel={vi.fn()} onSubmit={submit} />);
    const user = userEvent.setup();
    await user.type(screen.getByRole("textbox", { name: "Search patients" }), "active");
    await waitFor(() => expect(patientApi.getPatients).toHaveBeenCalledWith({ search: "active" }));
    expect(screen.getByRole("button", { name: "Active Patient" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Archived Patient" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Active Patient" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Optional visit" }), "8");
    await user.type(screen.getByRole("textbox", { name: "Title override" }), "Attached title");
    await user.type(screen.getByRole("textbox", { name: "Notes override" }), "Attached notes");
    await user.click(screen.getByRole("button", { name: "Attach to patient" }));
    expect(submit).toHaveBeenCalledWith({ patient_id: 3, visit_id: 8, title: "Attached title", notes: "Attached notes" });
  });

  it("keeps a pending destructive confirmation closed to every close route", () => {
    const cancel = vi.fn(); const confirm = vi.fn();
    render(<DiscardExternalXrayDialog external={external} isSubmitting onCancel={cancel} onConfirm={confirm} />);
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(cancel).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Discarding" })).toBeDisabled();
    expect(confirm).not.toHaveBeenCalled();
  });
});
