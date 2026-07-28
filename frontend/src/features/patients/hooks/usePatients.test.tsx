import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { getPatients } from "../../../api/endpoints/patients";
import type { PatientListFilters } from "../../../types/patients";
import { usePatients } from "./usePatients";

vi.mock("../../../api/endpoints/patients", () => ({ getPatients: vi.fn() }));

function Probe({ filters }: { filters: PatientListFilters }) {
  const patients = usePatients(filters);
  return <output data-testid="patients">{patients.data?.results[0]?.full_name ?? "loading"}</output>;
}

describe("usePatients", () => {
  it("does not let an older server search response replace the current result", async () => {
    let resolveOld: (value: never) => void = () => undefined;
    let resolveNew: (value: never) => void = () => undefined;
    vi.mocked(getPatients).mockImplementation((filters) => new Promise((resolve) => {
      if (filters?.search === "old") resolveOld = resolve as typeof resolveOld;
      else resolveNew = resolve as typeof resolveNew;
    }) as never);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = render(<QueryClientProvider client={client}><Probe filters={{ page: 1, search: "old" }} /></QueryClientProvider>);
    view.rerender(<QueryClientProvider client={client}><Probe filters={{ page: 1, search: "new" }} /></QueryClientProvider>);
    await waitFor(() => expect(getPatients).toHaveBeenCalledWith(expect.objectContaining({ search: "new" })));
    await act(async () => { resolveNew({ count: 1, next: null, previous: null, results: [{ full_name: "New patient" }] } as never); });
    await waitFor(() => expect(screen.getByTestId("patients")).toHaveTextContent("New patient"));
    await act(async () => { resolveOld({ count: 1, next: null, previous: null, results: [{ full_name: "Old patient" }] } as never); });
    expect(screen.getByTestId("patients")).toHaveTextContent("New patient");
  });
});
