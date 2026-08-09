import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "../../../auth/authStore";
import type { AIResult } from "../../../types/ai";
import type { UserRole } from "../../../types/auth";
import type { ExternalXrayCase } from "../../../types/xrays";
import { ExternalXrayDetail } from "./ExternalXrayDetail";

const hookState = vi.hoisted(() => ({
  aiResult: undefined as AIResult | undefined,
  aiError: null as unknown,
  run: vi.fn(),
  runReset: vi.fn(),
  runPending: false,
  runError: null as unknown,
  attachReset: vi.fn(),
  discardReset: vi.fn(),
}));

vi.mock("../hooks/useXrays", () => ({
  useExternalAiResult: (_id: number, enabled: boolean) => ({
    data: enabled ? hookState.aiResult : undefined,
    isLoading: false,
    error: hookState.aiError,
    refetch: vi.fn(),
  }),
  useExternalXrayMutations: () => ({
    runAi: { mutate: hookState.run, reset: hookState.runReset, isPending: hookState.runPending, error: hookState.runError },
    attach: { mutateAsync: vi.fn(), reset: hookState.attachReset, isPending: false, error: null },
    discard: { mutateAsync: vi.fn(), reset: hookState.discardReset, isPending: false, error: null },
  }),
}));
vi.mock("./ProtectedXrayViewer", () => ({
  ProtectedXrayViewer: ({ overlayAvailable }: { overlayAvailable?: boolean }) => (
    <div data-testid="protected-viewer" data-overlay={String(Boolean(overlayAvailable))} />
  ),
}));

const external = {
  id: 11,
  uploaded_by: { id: 7, full_name: "Doctor One" },
  title: "Golden panoramic",
  notes: "Research fixture",
  status: "TEMPORARY",
  stored_file_name: "stored.png",
  original_file_name: "train_87.png",
  content_type: "image/png",
  size_bytes: 1024,
  attached_patient: null,
  attached_visit: null,
  attached_xray: null,
  discarded_at: null,
  attached_at: null,
  file_endpoint: "/api/external-xrays/11/file/",
  ai_result_endpoint: "/api/external-xrays/11/ai-result/",
  ai_overlay_endpoint: "/api/external-xrays/11/ai-overlay/",
  has_ai_result: false,
  created_at: "2026-08-09T10:00:00Z",
  updated_at: "2026-08-09T10:00:00Z",
} as ExternalXrayCase;

function aiResult(status: AIResult["status"]): AIResult {
  return {
    id: 20,
    xray_attachment: null,
    external_xray_case: { id: 11, status: "TEMPORARY", title: "Golden panoramic", original_file_name: "train_87.png", created_at: "2026-08-09T10:00:00Z" },
    status,
    result_summary: "Research-only AI analysis completed.",
    overall_confidence: null,
    overall_confidence_percent: null,
    findings: status === "COMPLETED" ? [{ fdi_tooth_id: "17", disease_label: "Deep Caries", model_score: 0.504811, threshold: 0.5, decision: "flagged", is_positive: true }] : [],
    overlay_available: status === "COMPLETED",
    model_version: "dentex-real-v1",
    error_message: status === "FAILED" ? "AI analysis failed." : "",
    disclaimer: "Research only. Not a clinical diagnosis.",
    disclaimer_ar: "للبحث فقط.",
    created_at: "2026-08-09T10:00:00Z",
    updated_at: "2026-08-09T10:00:03Z",
  };
}

function setUser(role: UserRole, id = 7) {
  useAuthStore.setState({
    user: {
      id,
      full_name: `${role} User`,
      email: `${role.toLowerCase()}@example.test`,
      role,
      is_active: true,
      must_change_password: false,
      password_changed_at: null,
      theme_preference: "LIGHT",
      language_preference: "EN",
    },
  });
}

function renderDetail(role: UserRole, record = external) {
  return render(<MemoryRouter><ExternalXrayDetail role={role} external={record} /></MemoryRouter>);
}

describe("ExternalXrayDetail AI lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hookState.aiResult = undefined;
    hookState.aiError = null;
    hookState.runPending = false;
    hookState.runError = null;
    setUser("DOCTOR");
  });

  it("shows Run AI to the owning Doctor and invokes the existing mutation", () => {
    renderDetail("DOCTOR");
    fireEvent.click(screen.getByRole("button", { name: "Run AI Analysis" }));
    expect(hookState.run).toHaveBeenCalledWith(11);
    expect(screen.getByRole("button", { name: "Attach to patient" })).toBeEnabled();
  });

  it("allows Admin to run temporary external AI while keeping attachment Doctor-only", () => {
    setUser("ADMIN", 2);
    renderDetail("ADMIN");
    expect(screen.getByRole("button", { name: "Run AI Analysis" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Attach to patient" })).not.toBeInTheDocument();
  });

  it("keeps Staff external AI authority absent", () => {
    setUser("STAFF", 3);
    renderDetail("STAFF");
    expect(screen.queryByRole("button", { name: "Run AI Analysis" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Discard case" })).not.toBeInTheDocument();
  });

  it("disables run, attach, and discard while processing", () => {
    hookState.aiResult = aiResult("PROCESSING");
    renderDetail("DOCTOR", { ...external, has_ai_result: true });

    expect(screen.getByRole("button", { name: "Analyzing…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Attach to patient" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Discard case" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Analyzing…");
  });

  it("offers Retry AI for a failed temporary external result", () => {
    hookState.aiResult = aiResult("FAILED");
    renderDetail("DOCTOR", { ...external, has_ai_result: true });

    fireEvent.click(screen.getByRole("button", { name: "Retry AI" }));
    expect(hookState.run).toHaveBeenCalledWith(11);
    expect(screen.getByRole("alert")).toHaveTextContent("AI analysis failed.");
  });

  it("renders a completed real result and enables the current protected overlay without reload", () => {
    hookState.aiResult = aiResult("COMPLETED");
    renderDetail("DOCTOR", { ...external, has_ai_result: true });

    expect(screen.getByText("Deep Caries")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Model score" })).toBeInTheDocument();
    expect(screen.getByTestId("protected-viewer")).toHaveAttribute("data-overlay", "true");
    expect(screen.queryByRole("button", { name: "Run AI Analysis" })).not.toBeInTheDocument();
  });
});
