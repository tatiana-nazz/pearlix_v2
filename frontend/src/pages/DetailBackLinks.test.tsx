import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "../auth/authStore";
import { VisitDetailPage } from "./visits/VisitDetailPage";
import { ExternalXrayDetailPage } from "./xrays/ExternalXrayPages";
import { XrayDetailPage } from "./xrays/XrayDetailPage";

const mocks = vi.hoisted(() => ({
  useExternalXray: vi.fn(),
  useVisit: vi.fn(),
  useXray: vi.fn(),
}));

vi.mock("../features/visits/hooks/useVisits", () => ({ useVisit: mocks.useVisit }));
vi.mock("../features/visits/components/VisitWorkspace", () => ({ VisitWorkspace: () => <div>Visit workspace</div> }));
vi.mock("../features/xrays/hooks/useXrays", () => ({
  useExternalXray: mocks.useExternalXray,
  useExternalXrayMutations: vi.fn(),
  useExternalXrays: vi.fn(),
  useXray: mocks.useXray,
}));
vi.mock("../features/xrays/components/XrayDetail", () => ({ XrayDetail: () => <div>Saved X-ray</div> }));
vi.mock("../features/xrays/components/ExternalXrayDetail", () => ({ ExternalXrayDetail: () => <div>External X-ray</div> }));

const settledQuery = (data: unknown) => ({ data, error: null, isError: false, isLoading: false, refetch: vi.fn() });

describe("detail-page parent links", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      role: "DOCTOR",
      user: { id: 7, email: "doctor@example.test", full_name: "Doctor", role: "DOCTOR", is_active: true, must_change_password: false, password_changed_at: null, theme_preference: "LIGHT", language_preference: "EN" },
    });
    mocks.useVisit.mockReturnValue(settledQuery({ id: 4, status: "COMPLETED", patient: { id: 12, full_name: "Maya Patient" } }));
    mocks.useXray.mockReturnValue(settledQuery({ id: 8 }));
    mocks.useExternalXray.mockReturnValue(settledQuery({ id: 9 }));
  });

  it("returns a visit to its patient when opened from patient history", () => {
    render(<MemoryRouter initialEntries={[{ pathname: "/doctor/visits/4", state: { visitParent: "patient" } }]}><Routes><Route path="/doctor/visits/:visitId" element={<VisitDetailPage role="DOCTOR" />} /></Routes></MemoryRouter>);

    expect(screen.getByRole("link", { name: "Back to Patient" })).toHaveAttribute("href", "/doctor/patients/12?tab=visits");
  });

  it("returns a direct visit to the patient's Visits context", () => {
    render(<MemoryRouter initialEntries={["/doctor/visits/4"]}><Routes><Route path="/doctor/visits/:visitId" element={<VisitDetailPage role="DOCTOR" />} /></Routes></MemoryRouter>);

    expect(screen.getByRole("link", { name: "Back to Visits" })).toHaveAttribute("href", "/doctor/patients/12?tab=visits");
  });

  it("returns saved and external X-rays to their respective workspaces", () => {
    const saved = render(<MemoryRouter initialEntries={["/doctor/xrays/8"]}><Routes><Route path="/doctor/xrays/:xrayId" element={<XrayDetailPage role="DOCTOR" />} /></Routes></MemoryRouter>);
    expect(screen.getByRole("link", { name: "Back to X-rays & AI" })).toHaveAttribute("href", "/doctor/xrays");
    saved.unmount();

    render(<MemoryRouter initialEntries={["/doctor/external-xrays/9"]}><Routes><Route path="/doctor/external-xrays/:caseId" element={<ExternalXrayDetailPage role="DOCTOR" />} /></Routes></MemoryRouter>);
    expect(screen.getByRole("link", { name: "Back to External X-rays" })).toHaveAttribute("href", "/doctor/external-xrays");
  });
});
