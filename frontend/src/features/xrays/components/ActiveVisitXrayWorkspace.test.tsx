import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "../../../auth/authStore";
import type { AIResult } from "../../../types/ai";
import type { VisitDetail } from "../../../types/visits";
import type { XrayAttachment } from "../../../types/xrays";
import { ActiveVisitXrayWorkspace } from "./ActiveVisitXrayWorkspace";

const hookState = vi.hoisted(() => ({
  run: vi.fn(),
  upload: vi.fn(),
  uploadReset: vi.fn(),
  runReset: vi.fn(),
}));

const baseXray = {
  id: 1,
  patient: { id: 44, full_name: "Ada Lovelace" },
  visit: { id: 91, status: "ACTIVE", started_at: "2026-07-26T09:01:00Z", completed_at: null },
  uploaded_by: { id: 7, full_name: "Doctor One" },
  source: "ACTIVE_VISIT",
  title: "Bitewing without AI",
  notes: "Synthetic",
  stored_file_name: "stored.png",
  original_file_name: "bitewing.png",
  content_type: "image/png",
  size_bytes: 1024,
  file_endpoint: "/api/xrays/1/file/",
  ai_result_endpoint: "/api/xrays/1/ai-result/",
  ai_overlay_endpoint: "/api/xrays/1/ai-overlay/",
  has_ai_result: false,
  created_at: "2026-07-26T09:00:00Z",
  updated_at: "2026-07-26T09:00:00Z",
} as XrayAttachment;
const storedXray = { ...baseXray, id: 2, title: "Panoramic with AI", file_endpoint: "/api/xrays/2/file/", ai_result_endpoint: "/api/xrays/2/ai-result/", ai_overlay_endpoint: "/api/xrays/2/ai-overlay/", has_ai_result: true };
const uploadedXray = { ...baseXray, id: 3, title: "New upload", file_endpoint: "/api/xrays/3/file/" };
const result = { id: 4, status: "COMPLETED", result_summary: "Stored research result", overall_confidence: .75, overall_confidence_percent: 75, findings: [], overlay_available: true, model_version: "mock-v1", error_message: "", disclaimer: "Research only.", disclaimer_ar: "", xray_attachment: null, external_xray_case: null, created_at: "2026-07-26T09:00:00Z", updated_at: "2026-07-26T09:00:00Z" } as AIResult;

vi.mock("../hooks/useXrays", () => ({
  useXrays: () => ({ data: { count: 2, results: [baseXray, storedXray], next: null, previous: null }, isLoading: false, isError: false, refetch: vi.fn() }),
  useXray: (id: number) => ({ data: [baseXray, storedXray, uploadedXray].find((xray) => xray.id === id), isLoading: false, isError: false, refetch: vi.fn() }),
  useXrayAiResult: (id: number, enabled: boolean) => ({ data: id === 2 && enabled ? result : undefined, isLoading: false, error: null, refetch: vi.fn() }),
  useXrayAiResults: (ids: number[]) => ids.map((id) => ({ data: id === 2 ? result : undefined, isLoading: false, error: null })),
  useRunSavedXrayAi: () => ({ mutate: hookState.run, reset: hookState.runReset, isPending: false, error: null }),
  useVisitXrayUpload: () => ({ mutateAsync: hookState.upload, reset: hookState.uploadReset, isPending: false, error: null }),
}));
vi.mock("../hooks/useProtectedMedia", () => ({ useProtectedMedia: (endpoint?: string | null) => ({ url: endpoint ? `blob:${endpoint}` : null, isLoading: false, error: null, retry: vi.fn() }) }));
vi.mock("./ProtectedXrayViewer", () => ({ ProtectedXrayViewer: ({ originalEndpoint, originalLabel, overlayVisible }: { originalEndpoint: string; originalLabel: string; overlayVisible?: boolean }) => <div data-testid="protected-viewer" data-endpoint={originalEndpoint} data-overlay={String(Boolean(overlayVisible))}>{originalLabel}</div> }));

const visit = {
  id: 91,
  appointment: { id: 17, start_datetime: "2026-07-26T09:00:00Z", end_datetime: "2026-07-26T09:30:00Z", duration_minutes: 30, status: "ACTIVE", reason: "Review" },
  patient: { id: 44, first_name: "Ada", last_name: "Lovelace", full_name: "Ada Lovelace", gender: "Female", date_of_birth: "1985-01-01", age: 41, phone_number: "555-0100", email: "ada@example.test", national_id_or_passport: null, blood_group: "O+", is_archived: false, version: 1, created_at: "2026-01-01", updated_at: "2026-01-01" },
  doctor: { id: 7, full_name: "Doctor One", email: "doctor@example.test", role: "DOCTOR" },
  status: "ACTIVE", started_at: "2026-07-26T09:01:00Z", completed_at: null, symptoms: "", diagnosis: "", treatment: "", clinical_notes: "", follow_up_notes: "", created_at: "2026-07-26", updated_at: "2026-07-26",
} as VisitDetail;

function setUser(role: "DOCTOR" | "STAFF") {
  useAuthStore.setState({ user: { id: role === "DOCTOR" ? 7 : 8, full_name: "Workspace User", email: "user@example.test", role, is_active: true, must_change_password: false, password_changed_at: null, theme_preference: "LIGHT", language_preference: "EN" } });
}

describe("ActiveVisitXrayWorkspace", () => {
  beforeEach(() => {
    hookState.run.mockReset();
    hookState.upload.mockReset();
    hookState.upload.mockResolvedValue(uploadedXray);
    setUser("DOCTOR");
  });

  it("prioritizes the overlay-capable X-ray and keeps the top-level switch visible across selections", async () => {
    const { container } = render(<ActiveVisitXrayWorkspace role="DOCTOR" visit={visit} />);
    expect(await screen.findByTestId("protected-viewer")).toHaveAttribute("data-endpoint", "/api/xrays/2/file/");
    expect(screen.getByText("Stored research result")).toBeInTheDocument();
    const mainRow = container.querySelector<HTMLElement>(".active-xray-main-row")!;
    const aiPanel = container.querySelector<HTMLElement>(".active-xray-ai-result")!;
    const history = container.querySelector<HTMLElement>(".active-xray-history-panel")!;
    const details = container.querySelector<HTMLElement>(".active-xray-analysis-details")!;
    expect(within(aiPanel).getByText("AI Result")).toBeInTheDocument();
    expect(within(aiPanel).getByText("75%")).toBeInTheDocument();
    expect(within(aiPanel).getByText("Stored research result")).toBeInTheDocument();
    expect(within(aiPanel).queryByText("Model Version")).not.toBeInTheDocument();
    expect(within(aiPanel).queryByText("Research-only AI analysis")).not.toBeInTheDocument();
    expect(within(details).getByText("AI Analysis Details")).toBeInTheDocument();
    expect(within(details).getByText("Model Version")).toBeInTheDocument();
    expect(within(details).getByText("Research-only AI analysis")).toBeInTheDocument();
    expect(mainRow.compareDocumentPosition(history) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(history.compareDocumentPosition(details) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const overlay = screen.getByRole("switch", { name: "AI Overlay: Off" });
    expect(overlay).toBeEnabled();
    expect(overlay).toHaveAttribute("aria-checked", "false");
    fireEvent.click(overlay);
    expect(screen.getByRole("switch", { name: "AI Overlay: On" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByTestId("protected-viewer")).toHaveAttribute("data-overlay", "true");
    fireEvent.click(screen.getByRole("button", { name: "Bitewing without AI" }));
    expect(screen.getByTestId("protected-viewer")).toHaveAttribute("data-endpoint", "/api/xrays/1/file/");
    expect(screen.getByRole("switch", { name: "AI Overlay: Off" })).toBeDisabled();
    expect(screen.getByTestId("protected-viewer")).toHaveAttribute("data-overlay", "false");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("exposes the existing AI mutation only to Doctor for a result-free saved X-ray", async () => {
    render(<ActiveVisitXrayWorkspace role="DOCTOR" visit={visit} />);
    fireEvent.click(screen.getByRole("button", { name: "Bitewing without AI" }));
    const run = await screen.findByRole("button", { name: "Run AI Analysis" });
    fireEvent.click(run);
    expect(hookState.run).toHaveBeenCalledTimes(1);
  });

  it("selects a newly uploaded visit X-ray without navigating away", async () => {
    render(<ActiveVisitXrayWorkspace role="DOCTOR" visit={visit} />);
    fireEvent.click(screen.getByRole("button", { name: "Upload X-ray" }));
    const file = new File(["image"], "new-xray.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("Choose file"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Upload" }));
    await waitFor(() => expect(hookState.upload).toHaveBeenCalledWith({ file, title: "", notes: "" }));
    await waitFor(() => expect(screen.getByTestId("protected-viewer")).toHaveAttribute("data-endpoint", "/api/xrays/3/file/"));
  });

  it("keeps Staff read-only without upload or AI-run actions", async () => {
    setUser("STAFF");
    render(<ActiveVisitXrayWorkspace role="STAFF" visit={visit} />);
    expect(await screen.findByTestId("protected-viewer")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Upload X-ray" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Run AI Analysis" })).not.toBeInTheDocument();
  });
});
