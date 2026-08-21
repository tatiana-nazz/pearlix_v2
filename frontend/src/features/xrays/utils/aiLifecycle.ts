import { toApiClientError } from "../../../api/errors";
import type { AIFinding, AIResultStatus } from "../../../types/ai";
import type { XrayCopy } from "../i18n";

export function isAiAnalysisActive(status: AIResultStatus | undefined): boolean {
  return status === "PENDING" || status === "PROCESSING";
}

export function findingScorePercent(finding: AIFinding): number | null {
  if (typeof finding.model_score === "number" && Number.isFinite(finding.model_score)) {
    return Math.round(finding.model_score * 100);
  }
  if (typeof finding.confidence_percent === "number" && Number.isFinite(finding.confidence_percent)) {
    return Math.round(finding.confidence_percent);
  }
  if (typeof finding.confidence_score === "number" && Number.isFinite(finding.confidence_score)) {
    return Math.round(finding.confidence_score * 100);
  }
  return null;
}

export function findingThresholdPercent(finding: AIFinding): number | null {
  return typeof finding.threshold === "number" && Number.isFinite(finding.threshold)
    ? Math.round(finding.threshold * 100)
    : null;
}

export function aiErrorCode(error: unknown): string | null {
  return error ? toApiClientError(error).code : null;
}

export function aiRunErrorMessage(error: unknown, copy: XrayCopy): string | null {
  const code = aiErrorCode(error);
  if (!code) return null;
  if (code === "AI_ANALYSIS_IN_PROGRESS") return copy.analysisAlreadyRunning;
  if (code === "AI_SERVICE_NOT_CONFIGURED") return copy.aiNotConfigured;
  if (code === "AI_CAPACITY_BUSY") return copy.aiCapacityBusy;
  if (code === "AI_RATE_LIMITED") return copy.aiRateLimited;
  if (code === "AI_IMAGE_INVALID") return copy.aiImageInvalid;
  return copy.aiRequestFailed;
}
