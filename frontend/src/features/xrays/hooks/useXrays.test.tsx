import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiClientError } from "../../../api/errors";
import type { AIResult, AIResultStatus } from "../../../types/ai";
import {
  AI_RESULT_POLL_INTERVAL_MS,
  aiResultRefetchInterval,
  useExternalXrayMutations,
  useRunSavedXrayAi,
} from "./useXrays";

const api = vi.hoisted(() => ({
  runAi: vi.fn(),
  aiResult: vi.fn(),
  runExternalAi: vi.fn(),
  externalAiResult: vi.fn(),
  externalList: vi.fn(),
  externalDetail: vi.fn(),
  createExternal: vi.fn(),
  discardExternal: vi.fn(),
  attachExternalToPatient: vi.fn(),
}));

vi.mock("../../../api/endpoints/xrays", () => ({ xraysApi: api }));

function aiResult(status: AIResultStatus = "COMPLETED"): AIResult {
  return {
    id: 22,
    xray_attachment: { id: 4, patient_id: 3, visit_id: 2, title: "", original_file_name: "x.png", created_at: "2026-08-09" },
    external_xray_case: null,
    status,
    result_summary: "Result",
    overall_confidence: null,
    overall_confidence_percent: null,
    findings: [],
    overlay_available: status === "COMPLETED",
    model_version: "dentex-real-v1",
    error_message: "",
    disclaimer: "Research only",
    disclaimer_ar: "للبحث فقط",
    created_at: "2026-08-09T10:00:00Z",
    updated_at: "2026-08-09T10:00:03Z",
  };
}

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

describe("X-ray AI lifecycle queries", () => {
  beforeEach(() => vi.clearAllMocks());

  it("polls pending and processing results at two seconds and stops for terminal states", () => {
    expect(aiResultRefetchInterval(aiResult("PENDING"))).toBe(AI_RESULT_POLL_INTERVAL_MS);
    expect(aiResultRefetchInterval(aiResult("PROCESSING"))).toBe(AI_RESULT_POLL_INTERVAL_MS);
    expect(aiResultRefetchInterval(aiResult("COMPLETED"))).toBe(false);
    expect(aiResultRefetchInterval(aiResult("FAILED"))).toBe(false);
    expect(aiResultRefetchInterval()).toBe(false);
  });

  it("places a completed saved-X-ray result into the query cache immediately", async () => {
    const completed = aiResult();
    api.runAi.mockResolvedValue(completed);
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useRunSavedXrayAi(4), { wrapper });

    await act(async () => { await result.current.mutateAsync(); });

    expect(client.getQueryData(["xray-ai-result", 4])).toEqual(completed);
  });

  it("treats 409 as active work and refreshes the processing result", async () => {
    const processing = aiResult("PROCESSING");
    api.runAi.mockRejectedValue(new ApiClientError({
      code: "AI_ANALYSIS_IN_PROGRESS",
      message: "Already running",
      details: {},
      status: 409,
    }));
    api.aiResult.mockResolvedValue(processing);
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useRunSavedXrayAi(4), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync()).rejects.toMatchObject({ code: "AI_ANALYSIS_IN_PROGRESS" });
    });

    await waitFor(() => expect(client.getQueryData(["xray-ai-result", 4])).toEqual(processing));
    expect(api.aiResult).toHaveBeenCalledWith(4);
  });

  it("updates the external result cache immediately after completion", async () => {
    const completed = { ...aiResult(), xray_attachment: null, external_xray_case: { id: 8, status: "TEMPORARY", title: "", original_file_name: "x.png", created_at: "2026-08-09" } };
    api.runExternalAi.mockResolvedValue(completed);
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useExternalXrayMutations(), { wrapper });

    await act(async () => { await result.current.runAi.mutateAsync(8); });

    expect(client.getQueryData(["external-xray-ai-result", 8])).toEqual(completed);
  });
});
