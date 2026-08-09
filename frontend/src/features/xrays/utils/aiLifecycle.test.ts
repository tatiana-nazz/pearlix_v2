import { describe, expect, it } from "vitest";

import { ApiClientError } from "../../../api/errors";
import { xrayCopy } from "../i18n";
import {
  aiRunErrorMessage,
  findingScorePercent,
  findingThresholdPercent,
  isAiAnalysisActive,
} from "./aiLifecycle";

function apiError(code: string, status: number) {
  return new ApiClientError({ code, status, message: "Private backend detail", details: {} });
}

describe("AI lifecycle helpers", () => {
  it("prefers model_score over compatibility confidence values", () => {
    expect(findingScorePercent({ model_score: 0.504811, confidence_percent: 99 })).toBe(50);
    expect(findingScorePercent({ confidence_percent: 82 })).toBe(82);
    expect(findingScorePercent({ confidence_score: 0.61 })).toBe(61);
    expect(findingScorePercent({ model_score: Number.NaN })).toBeNull();
    expect(findingThresholdPercent({ threshold: 0.44 })).toBe(44);
  });

  it("identifies only pending and processing as active", () => {
    expect(isAiAnalysisActive("PENDING")).toBe(true);
    expect(isAiAnalysisActive("PROCESSING")).toBe(true);
    expect(isAiAnalysisActive("COMPLETED")).toBe(false);
    expect(isAiAnalysisActive("FAILED")).toBe(false);
  });

  it("maps stable AI error codes to calm localized messages", () => {
    const copy = xrayCopy("EN");
    expect(aiRunErrorMessage(apiError("AI_ANALYSIS_IN_PROGRESS", 409), copy)).toBe("AI analysis is already running.");
    expect(aiRunErrorMessage(apiError("AI_SERVICE_NOT_CONFIGURED", 503), copy)).toBe("AI service is currently unavailable.");
    expect(aiRunErrorMessage(apiError("AI_IMAGE_INVALID", 400), copy)).toBe("This X-ray image could not be analyzed.");
    expect(aiRunErrorMessage(apiError("AI_ANALYSIS_FAILED", 500), copy)).toBe(copy.aiRequestFailed);
    expect(aiRunErrorMessage(null, copy)).toBeNull();
  });
});
