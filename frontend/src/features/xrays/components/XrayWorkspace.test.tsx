import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "../../../auth/authStore";
import type { AIResult } from "../../../types/ai";
import type { XrayAttachment } from "../../../types/xrays";
import { AiResultPanel } from "./AiResultPanel";
import { XrayList } from "./XrayList";
import { XrayUploadDialog } from "./XrayUploadDialog";

const navigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => ({ ...(await importOriginal<typeof import("react-router-dom")>()), useNavigate: () => navigate }));
vi.mock("./ProtectedXrayImage", () => ({ ProtectedXrayImage: ({ enabled = true }: { enabled?: boolean }) => enabled ? <span>Protected image</span> : null }));

const xray = {
  id: 4,
  patient: { id: 2, full_name: "Amina Khalil" },
  visit: null,
  uploaded_by: { id: 7, full_name: "Dr Noor" },
  source: "PATIENT_PROFILE",
  title: "Bitewing",
  notes: "Baseline image",
  stored_file_name: "stored.png",
  original_file_name: "bitewing.png",
  content_type: "image/png",
  size_bytes: 1024,
  file_endpoint: "/api/xrays/4/file/",
  ai_result_endpoint: "/api/xrays/4/ai-result/",
  ai_overlay_endpoint: "/api/xrays/4/ai-overlay/",
  has_ai_result: false,
  created_at: "2026-07-26T09:00:00Z",
  updated_at: "2026-07-26T09:00:00Z",
} as XrayAttachment;

function setLanguage(language_preference: "EN" | "AR" = "EN") {
  useAuthStore.setState({ user: { id: 7, full_name: "Dr Noor", email: "doctor@example.test", role: "DOCTOR", is_active: true, must_change_password: false, password_changed_at: null, theme_preference: "LIGHT", language_preference } });
}

describe("X-ray workspace", () => {
  beforeEach(() => { navigate.mockReset(); setLanguage(); });

  it("keeps saved X-ray records action-free and opens the whole row by pointer and keyboard", () => {
    render(<MemoryRouter><XrayList role="DOCTOR" xrays={[xray]} /></MemoryRouter>);
    expect(screen.queryByText("Actions")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    const row = screen.getByRole("row", { name: /bitewing.*amina khalil/i });
    fireEvent.click(row);
    fireEvent.keyDown(row, { key: "Enter" });
    fireEvent.keyDown(row, { key: " " });
    expect(navigate).toHaveBeenCalledWith("/doctor/xrays/4");
    expect(navigate).toHaveBeenCalledTimes(3);
  });

  it("requires a supported image file before upload and retains the selected file", () => {
    const onSubmit = vi.fn();
    render(<XrayUploadDialog title="Upload X-ray" isSubmitting={false} onCancel={vi.fn()} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole("button", { name: "Upload" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Select a PNG or JPEG image.");
    const file = new File(["image"], "fixture.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("Choose file"), { target: { files: [file] } });
    expect(screen.getByText(/fixture\.png/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Upload" }));
    expect(onSubmit).toHaveBeenCalledWith({ file, title: "", notes: "" });
  });

  it("shows stored AI information without exposing a Run AI control and fetches an overlay only after its toggle", () => {
    const result = { id: 3, status: "COMPLETED", result_summary: "Stored result", overall_confidence: 0.8, overall_confidence_percent: 80, findings: [], overlay_available: true, model_version: "stored-v1", error_message: "", disclaimer: "Review independently.", disclaimer_ar: "", xray_attachment: null, external_xray_case: null, created_at: "2026-07-26T09:00:00Z", updated_at: "2026-07-26T09:30:00Z" } as AIResult;
    render(<AiResultPanel result={result} isLoading={false} overlayEndpoint="/api/xrays/4/ai-overlay/" onRetry={vi.fn()} />);
    expect(screen.getByText("Stored result")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Run AI" })).not.toBeInTheDocument();
    const overlay = screen.getByRole("button", { name: "Show overlay" });
    expect(overlay).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(overlay);
    expect(overlay).toHaveAttribute("aria-pressed", "true");
  });
});
