import { Sparkles } from "lucide-react";

import { useAuthStore } from "../../../auth/authStore";
import { Card } from "../../../components/Card";
import { StatusPill } from "../../../components/StatusPill";
import { Button, StatePanel } from "../../../components/v2";
import type { AIResult } from "../../../types/ai";
import { formatDateTime } from "../../../utils/dates";
import { xrayCopy } from "../i18n";
import { xrayText } from "../utils/xrayPresentation";

interface AiResultPanelProps {
  result?: AIResult;
  isLoading: boolean;
  error?: unknown;
  onRetry: () => void;
}

export function AiResultPanel({ result, isLoading, error, onRetry }: AiResultPanelProps) {
  const c = xrayCopy(useAuthStore((state) => state.user?.language_preference));
  if (isLoading) return <div className="active-xray-ai-panel"><StatePanel state="loading" title={c.loadingAiResult} /></div>;
  if (error) return <div className="active-xray-ai-panel"><StatePanel state="error" title={c.aiResultUnavailable} action={<Button variant="secondary" type="button" onClick={onRetry}>{c.retry}</Button>} /></div>;
  if (!result) return <Card><div className="active-xray-ai-panel xray-ai-empty"><h3><Sparkles size={20} aria-hidden="true" />{c.aiResult}</h3><p>{c.noResult}</p></div></Card>;

  const status = result.status === "PROCESSING" || result.status === "PENDING" ? c.processing : result.status === "FAILED" ? c.failed : result.status;
  return <Card><div className="active-xray-ai-panel">
    <div className="section-header"><h3><Sparkles size={20} aria-hidden="true" />{c.aiResult}</h3></div>
    <div className="xray-ai-header"><StatusPill status={result.status} /><span><strong>{c.status}:</strong> {status}</span></div>
    <dl className="xray-ai-highlight"><div><dt>{c.overallConfidence}</dt><dd dir="ltr">{result.overall_confidence_percent === null ? "—" : `${result.overall_confidence_percent}%`}</dd></div></dl>
    {result.result_summary ? <p className="xray-summary">{result.result_summary}</p> : null}
    {result.status === "FAILED" && result.error_message ? <p className="form-error" role="alert">{result.error_message}</p> : null}
    <section className="xray-findings" aria-labelledby="xray-findings-title"><h4 id="xray-findings-title">{c.findings}</h4>
      {result.findings.length ? <div className="xray-findings-scroll"><table><thead><tr><th>{c.fdi}</th><th>{c.finding}</th><th>{c.confidence}</th></tr></thead><tbody>{result.findings.map((finding, index) => <tr key={`${finding.fdi_tooth_id ?? "finding"}-${index}`}><td dir="ltr">{xrayText(finding.fdi_tooth_id)}</td><td>{xrayText(finding.disease_label)}</td><td dir="ltr">{finding.confidence_percent === undefined ? "—" : `${finding.confidence_percent}%`}</td></tr>)}</tbody></table></div> : <p>—</p>}
    </section>
  </div></Card>;
}

export function AiAnalysisDetails({ result }: { result?: AIResult }) {
  const c = xrayCopy(useAuthStore((state) => state.user?.language_preference));
  return <section className="active-xray-analysis-details" aria-labelledby="active-xray-analysis-details-title">
    <h4 id="active-xray-analysis-details-title">{c.aiAnalysisDetails}</h4>
    {result ? <dl className="xray-ai-metadata">
      <div><dt>{c.modelVersion}</dt><dd dir="ltr">{xrayText(result.model_version)}</dd></div>
      <div><dt>{c.created}</dt><dd dir="ltr">{formatDateTime(result.created_at) || "—"}</dd></div>
      <div><dt>{c.updated}</dt><dd dir="ltr">{formatDateTime(result.updated_at) || "—"}</dd></div>
      <div><dt>{c.overlayAvailability}</dt><dd>{result.overlay_available ? c.available : c.notAvailable}</dd></div>
    </dl> : null}
    <div className="ai-disclaimer" role="note"><strong>{c.researchOnly}</strong><span>{c.requiresInterpretation}. {c.notDiagnosis}.</span></div>
  </section>;
}
