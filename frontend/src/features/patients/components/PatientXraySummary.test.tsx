import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { PatientXraySummary } from "./PatientXraySummary";

vi.mock("../../xrays/hooks/useXrays", () => ({ usePatientXrayUpload: vi.fn(() => ({ isPending: false, error: null, reset: vi.fn(), mutateAsync: vi.fn() })) }));

const empty = { count: 0, next: null, previous: null, results: [] };

function renderSummary(role: "ADMIN" | "STAFF" | "DOCTOR", overrides: Partial<Parameters<typeof PatientXraySummary>[0]> = {}) {
  return render(<MemoryRouter><PatientXraySummary role={role} patientId={9} xrays={empty} aiResults={empty} isLoading={false} error={null} onRetry={vi.fn()} {...overrides} /></MemoryRouter>);
}

describe("PatientXraySummary", () => {
  it("renders a localized X-ray and AI heading with protected-media guidance", () => {
    renderSummary("STAFF");
    expect(screen.getByRole("heading", { name: "X-rays & AI" })).toBeInTheDocument();
    expect(screen.getByText(/authenticated access/)).toBeInTheDocument();
  });

  it("keeps the upload control limited to the Doctor contract", () => {
    const staff = renderSummary("STAFF");
    expect(screen.queryByRole("button", { name: "Upload X-ray" })).not.toBeInTheDocument();
    staff.unmount();
    renderSummary("DOCTOR");
    expect(screen.getByRole("button", { name: "Upload X-ray" })).toBeInTheDocument();
  });

  it("renders real empty states rather than fabricated imaging or AI records", () => {
    renderSummary("ADMIN");
    expect(screen.getByText("No saved X-rays found.")).toBeInTheDocument();
    expect(screen.getByText("No AI result has been saved for this X-ray.")).toBeInTheDocument();
  });

  it("keeps server errors retryable", () => {
    const onRetry = vi.fn();
    renderSummary("STAFF", { xrays: undefined, aiResults: undefined, error: new Error("Unavailable"), onRetry });
    expect(screen.getByText("X-ray information is unavailable")).toBeInTheDocument();
    screen.getByRole("button", { name: "Retry" }).click();
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
