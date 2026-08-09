import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "../../../auth/authStore";
import type { AIFinding, AIResult, AIResultStatus } from "../../../types/ai";
import { AiResultPanel } from "./AiResultPanel";

const realFinding: AIFinding = {
  fdi_tooth_id: "47",
  disease_label: "Deep Caries",
  model_score: 0.828523,
  threshold: 0.5,
  decision: "flagged",
  is_positive: true,
  detector_confidence: 0.91,
  hierarchy_forced: false,
  confidence_score: 0.828523,
  confidence_percent: 83,
};

function result(overrides: Partial<AIResult> = {}): AIResult {
  return {
    id: 9,
    xray_attachment: null,
    external_xray_case: null,
    status: "COMPLETED",
    result_summary: "Research-only AI analysis completed.",
    overall_confidence: null,
    overall_confidence_percent: null,
    findings: [realFinding],
    overlay_available: true,
    model_version: "dentex-real-v1",
    error_message: "",
    disclaimer: "Research-only AI assistance. Not a clinical diagnosis.",
    disclaimer_ar: "مساعدة ذكاء اصطناعي لأغراض بحثية فقط. ليست تشخيصاً طبياً.",
    created_at: "2026-08-09T10:00:00Z",
    updated_at: "2026-08-09T10:00:03Z",
    ...overrides,
  };
}

function setLanguage(language_preference: "EN" | "AR" = "EN") {
  useAuthStore.setState({
    user: {
      id: 7,
      full_name: "Doctor One",
      email: "doctor@example.test",
      role: "DOCTOR",
      is_active: true,
      must_change_password: false,
      password_changed_at: null,
      theme_preference: "LIGHT",
      language_preference,
    },
  });
}

describe("AiResultPanel real lifecycle presentation", () => {
  beforeEach(() => setLanguage());

  it("prefers typed model_score, labels flagged decisions, and omits nonexistent overall confidence", () => {
    render(<AiResultPanel result={result()} isLoading={false} onRetry={vi.fn()} />);

    expect(screen.getByRole("columnheader", { name: "Model score" })).toBeInTheDocument();
    expect(screen.getByText("83%")).toBeInTheDocument();
    expect(screen.getByLabelText("Status: Flagged")).toBeInTheDocument();
    expect(screen.queryByText("Overall Confidence")).not.toBeInTheDocument();
    expect(screen.getByText("Scores are uncalibrated model scores.")).toBeInTheDocument();
  });

  it("retains the legacy confidence fallback and overall-confidence block", () => {
    const legacy = result({
      overall_confidence: 0.8,
      overall_confidence_percent: 80,
      findings: [{ fdi_tooth_id: "36", disease_label: "Caries", confidence_percent: 71 }],
    });
    render(<AiResultPanel result={legacy} isLoading={false} onRetry={vi.fn()} />);

    expect(screen.getByText("Overall Confidence")).toBeInTheDocument();
    expect(screen.getByText("80%")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Confidence" })).toBeInTheDocument();
    expect(screen.getByText("71%")).toBeInTheDocument();
  });

  it("renders review separately and explains its operating threshold", () => {
    const review: AIFinding = {
      fdi_tooth_id: "17",
      disease_label: "Any Caries",
      model_score: 0.42,
      threshold: 0.44,
      decision: "review",
      is_positive: false,
    };
    render(<AiResultPanel result={result({ findings: [review] })} isLoading={false} onRetry={vi.fn()} />);

    expect(screen.getByLabelText("Status: Review")).toBeInTheDocument();
    expect(screen.getByText("42%")).toBeInTheDocument();
    expect(screen.getByText("Operating threshold: 44%")).toBeInTheDocument();
    expect(screen.queryByLabelText("Status: Flagged")).not.toBeInTheDocument();
  });

  it("keeps multiple real findings for the same FDI as independent rows", () => {
    render(<AiResultPanel result={result({
      findings: [realFinding, { ...realFinding, disease_label: "Any Caries", model_score: 0.91 }],
    })} isLoading={false} onRetry={vi.fn()} />);

    const table = screen.getByRole("table");
    expect(within(table).getAllByText("47")).toHaveLength(2);
    expect(within(table).getByText("Deep Caries")).toBeInTheDocument();
    expect(within(table).getByText("Any Caries")).toBeInTheDocument();
  });

  it.each<[AIResultStatus, string]>([
    ["PENDING", "Pending"],
    ["PROCESSING", "Analyzing…"],
  ])("renders %s as in progress without failure or findings", (status, label) => {
    render(<AiResultPanel result={result({ status, findings: [] })} isLoading={false} onRetry={vi.fn()} />);

    expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    expect(screen.getByRole("status")).toHaveTextContent("Analyzing…");
    expect(screen.queryByText("Findings")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders a failed result's safe error without presenting it as processing", () => {
    render(<AiResultPanel result={result({
      status: "FAILED",
      findings: [],
      error_message: "AI analysis failed safely.",
    })} isLoading={false} onRetry={vi.fn()} />);

    expect(screen.getByRole("alert")).toHaveTextContent("AI analysis failed safely.");
    expect(screen.queryByText("Analyzing…")).not.toBeInTheDocument();
  });

  it("uses the Arabic model-score and decision terminology", () => {
    setLanguage("AR");
    render(<AiResultPanel result={result()} isLoading={false} onRetry={vi.fn()} />);

    expect(screen.getByRole("columnheader", { name: "درجة النموذج" })).toBeInTheDocument();
    expect(screen.getByLabelText("Status: مُعلَّم")).toBeInTheDocument();
  });
});
