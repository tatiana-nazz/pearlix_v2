import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { archivePatient, updatePatient } from "../../../api/endpoints/patients";
import { useArchivePatient, useUpdatePatient } from "./usePatientMutations";

vi.mock("../../../api/endpoints/patients", () => ({
  archivePatient: vi.fn(),
  createPatient: vi.fn(),
  unarchivePatient: vi.fn(),
  updatePatient: vi.fn(),
}));

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe("patient mutations", () => {
  it("submits the current version and invalidates patient, dashboard, and availability caches after an update", async () => {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const invalidate = vi.spyOn(client, "invalidateQueries");
    vi.mocked(updatePatient).mockResolvedValue({ id: 12 } as never);
    const { result } = renderHook(() => useUpdatePatient(12), { wrapper: wrapperFor(client) });

    result.current.mutate({ first_name: "Ava", last_name: "Stone", version: 4 });

    await waitFor(() => expect(updatePatient).toHaveBeenCalledWith(12, { first_name: "Ava", last_name: "Stone", version: 4 }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["patients"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["dashboard"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["appointment-availability"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["patient", 12] });
  });

  it("uses the dedicated archive endpoint with the record version and refreshes the same dependent caches", async () => {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const invalidate = vi.spyOn(client, "invalidateQueries");
    vi.mocked(archivePatient).mockResolvedValue({ id: 12 } as never);
    const { result } = renderHook(() => useArchivePatient(), { wrapper: wrapperFor(client) });

    result.current.mutate({ id: 12, version: 9 });

    await waitFor(() => expect(archivePatient).toHaveBeenCalledWith(12, { version: 9 }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["patients"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["dashboard"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["appointment-availability"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["patient", 12] });
  });
});
