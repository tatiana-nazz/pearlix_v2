import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getPatients } from "../../../api/endpoints/patients";
import type { PatientListItem } from "../../../types/patients";
import { PatientPicker } from "./PatientPicker";

vi.mock("../../../api/endpoints/patients", () => ({ getPatients: vi.fn() }));

const patient: PatientListItem = {
  id: 11, first_name: "Nour", last_name: "Ali", full_name: "Nour Ali", gender: "Female", date_of_birth: null, age: 28,
  phone_number: "0933 123 456", email: "", national_id_or_passport: null, blood_group: "", is_archived: false, version: 1,
  created_at: "2026-07-01T00:00:00Z", updated_at: "2026-07-01T00:00:00Z",
};

function renderPicker() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <PatientPicker selectedPatient={null} onSelect={vi.fn()} onClear={vi.fn()} />
    </QueryClientProvider>,
  );
}

describe("PatientPicker", () => {
  beforeEach(() => {
    vi.mocked(getPatients).mockReset();
  });

  it("communicates loading, empty, and error search states without requesting patients before the minimum query", async () => {
    vi.mocked(getPatients).mockResolvedValue({ count: 0, next: null, previous: null, results: [] });
    renderPicker();
    const input = screen.getByRole("combobox", { name: "Patient" });

    await userEvent.type(input, "N");
    expect(getPatients).not.toHaveBeenCalled();
    await userEvent.type(input, "o");
    expect(await screen.findByText("No patients found.")).toBeInTheDocument();

    vi.mocked(getPatients).mockRejectedValueOnce(new Error("Network unavailable"));
    await userEvent.clear(input);
    await userEvent.type(input, "Nu");
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load patients.");
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("No patients found.")).toBeInTheDocument();
  });

  it("does not let a stale response replace the newest server-backed search", async () => {
    let resolveFirst: ((value: { count: number; next: null; previous: null; results: PatientListItem[] }) => void) | undefined;
    let resolveSecond: ((value: { count: number; next: null; previous: null; results: PatientListItem[] }) => void) | undefined;
    vi.mocked(getPatients)
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve; }));
    renderPicker();
    const input = screen.getByRole("combobox", { name: "Patient" });

    await userEvent.type(input, "No");
    await waitFor(() => expect(getPatients).toHaveBeenCalledTimes(1));
    await userEvent.clear(input);
    await userEvent.type(input, "Sa");
    await waitFor(() => expect(getPatients).toHaveBeenCalledTimes(2));

    resolveSecond?.({ count: 1, next: null, previous: null, results: [{ ...patient, id: 12, full_name: "Sara New" }] });
    expect(await screen.findByRole("option", { name: /Sara New/ })).toBeInTheDocument();
    resolveFirst?.({ count: 1, next: null, previous: null, results: [{ ...patient, full_name: "Nour Stale" }] });
    await waitFor(() => expect(screen.queryByText("Nour Stale")).not.toBeInTheDocument());
  });
});
