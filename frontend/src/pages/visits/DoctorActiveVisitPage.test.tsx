import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiClientError } from "../../api/errors";
import { useAuthStore } from "../../auth/authStore";
import { DoctorActiveVisitPage } from "./DoctorActiveVisitPage";

const activeVisitState = vi.hoisted(() => {
  type ActiveState = { data: { patient: { full_name: string } } | null; isLoading: boolean; isError: boolean; error: Error | null; refetch: ReturnType<typeof vi.fn> };
  const initial: ActiveState = { data: null, isLoading: false, isError: false, error: null, refetch: vi.fn() };
  return { current: initial };
});

vi.mock("../../features/visits/hooks/useVisits", () => ({ useActiveVisit: () => activeVisitState.current }));
vi.mock("../../features/visits/components/VisitWorkspace", () => ({ VisitWorkspace: ({ visit }: { visit: { patient: { full_name: string } } }) => <p>Active workspace for {visit.patient.full_name}</p> }));

describe("DoctorActiveVisitPage production route states", () => {
  afterEach(() => { useAuthStore.setState({ user: null }); activeVisitState.current = { data: null, isLoading: false, isError: false, error: null, refetch: vi.fn() }; });

  it("shows doctor day appointments when there is no active visit", () => {
    render(<MemoryRouter><DoctorActiveVisitPage /></MemoryRouter>);
    expect(screen.getByText("No active visit")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open day appointments" })).toHaveAttribute("href", "/doctor/appointments/day");
  });

  it("renders loading, error retry, denied, and populated states without backend copy", () => {
    activeVisitState.current = { data: null, isLoading: true, isError: false, error: null, refetch: vi.fn() };
    const { rerender } = render(<MemoryRouter><DoctorActiveVisitPage /></MemoryRouter>);
    expect(screen.getByText("Loading visit")).toBeInTheDocument();
    const retry = vi.fn();
    activeVisitState.current = { data: null, isLoading: false, isError: true, error: new ApiClientError({ code: "PERMISSION_DENIED", message: "forbidden", details: {}, status: 403 }), refetch: retry };
    rerender(<MemoryRouter><DoctorActiveVisitPage /></MemoryRouter>);
    expect(screen.getByText("This visit is not available for your role.")).toBeInTheDocument();
    screen.getByRole("button", { name: "Retry" }).click();
    expect(retry).toHaveBeenCalledOnce();
    activeVisitState.current = { data: { patient: { full_name: "Maya Patient" } }, isLoading: false, isError: false, error: null, refetch: vi.fn() };
    rerender(<MemoryRouter><DoctorActiveVisitPage /></MemoryRouter>);
    expect(screen.getByText("Active workspace for Maya Patient")).toBeInTheDocument();
  });
});
