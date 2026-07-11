import { Card } from "../../../components/Card";
import { EmptyState } from "../../../components/EmptyState";
import { ErrorState } from "../../../components/ErrorState";
import { LoadingState } from "../../../components/LoadingState";
import { StatusPill } from "../../../components/StatusPill";
import type { AIResult } from "../../../types/ai";
import { displayText } from "../../../utils/formatters";
import { ProtectedXrayImage } from "./ProtectedXrayImage";

interface AiResultPanelProps { result?: AIResult; isLoading: boolean; error?: unknown; overlayEndpoint: string; onRetry: () => void; }

export function AiResultPanel({ result, isLoading, error, overlayEndpoint, onRetry }: AiResultPanelProps) {
  if (isLoading) return <LoadingState title="Loading AI result..." />;
  if (error) return <ErrorState error={error} title="AI result unavailable" onRetry={onRetry} />;
  if (!result) return <EmptyState title="No AI result has been saved for this X-ray." />;
  return <Card><div className="section-header"><h3>AI result</h3><p>Research/supportive information only. Review independently before clinical use.</p></div>
    <div className="xray-ai-header"><StatusPill status={result.status} />{result.overall_confidence_percent !== null ? <strong>Confidence: {result.overall_confidence_percent}%</strong> : null}</div>
    <p className="xray-summary">{displayText(result.result_summary, "No summary returned.")}</p>
    {result.status === "FAILED" && result.error_message ? <p className="form-error">{result.error_message}</p> : null}
    {result.findings.length ? <ul className="summary-list-flat">{result.findings.map((finding, index) => <li className="summary-row" key={`${finding.fdi_tooth_id ?? "finding"}-${index}`}><div><strong>{displayText(finding.disease_label, "Finding")}</strong><span>Tooth: {displayText(finding.fdi_tooth_id, "Not specified")} · Confidence: {displayText(finding.confidence_percent, "Not reported")}{finding.confidence_percent ? "%" : ""}</span></div></li>)}</ul> : null}
    <div className="ai-disclaimer" role="note"><p>{result.disclaimer}</p>{result.disclaimer_ar ? <p lang="ar" dir="rtl">{result.disclaimer_ar}</p> : null}</div>
    {result.overlay_available ? <ProtectedXrayImage endpoint={overlayEndpoint} label="AI overlay" alt="Protected AI overlay for this X-ray" /> : null}
  </Card>;
}
