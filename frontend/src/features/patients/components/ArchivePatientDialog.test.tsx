import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ApiClientError } from "../../../api/errors";
import type { PatientListItem } from "../../../types/patients";
import { ArchivePatientDialog } from "./ArchivePatientDialog";

const patient = {
  id: 1,
  full_name: "QA Patient",
  phone: "555",
  gender: "UNSPECIFIED",
  birth_date: null,
  age: null,
  is_archived: false,
  created_at: "2026-07-10T08:00:00Z",
  updated_at: "2026-07-10T08:00:00Z",
} satisfies PatientListItem;

describe("ArchivePatientDialog", () => {
  it("uses archive wording and never delete wording", () => {
    render(<ArchivePatientDialog patient={patient} mode="archive" isSubmitting={false} onCancel={vi.fn()} onConfirm={vi.fn()} />);

    expect(screen.getByRole("dialog", { name: "Archive Patient" })).toBeInTheDocument();
    expect(screen.queryByText(/delete/i)).not.toBeInTheDocument();
  });

  it("calls confirm action", async () => {
    const onConfirm = vi.fn();
    render(<ArchivePatientDialog patient={patient} mode="archive" isSubmitting={false} onCancel={vi.fn()} onConfirm={onConfirm} />);

    await userEvent.click(screen.getByRole("button", { name: "Archive Patient" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("displays archive blocked errors", () => {
    const error = new ApiClientError({
      code: "ARCHIVE_BLOCKED",
      message: "Patient cannot be archived while active operational appointments exist.",
      details: {},
      status: 409,
    });

    render(<ArchivePatientDialog patient={patient} mode="archive" isSubmitting={false} error={error} onCancel={vi.fn()} onConfirm={vi.fn()} />);

    expect(screen.getByText("Patient cannot be archived while active operational appointments exist.")).toBeInTheDocument();
  });
});
