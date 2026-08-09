import { Sparkles } from "lucide-react";

import { useAuthStore } from "../../../auth/authStore";
import { Card } from "../../../components/Card";
import { StatusPill } from "../../../components/StatusPill";
import { Button, StatePanel } from "../../../components/v2";
import type { AIFinding, AIFindingDecision, AIResult, AIResultStatus } from "../../../types/ai";
import { formatDateTime } from "../../../utils/dates";
import { xrayCopy, type XrayCopy } from "../i18n";
import { findingScorePercent, findingThresholdPercent, isAiAnalysisActive } from "../utils/aiLifecycle";
import { xrayText } from "../utils/xrayPresentation";

interface AiResultPanelProps {
  result?: AIResult;
  isLoading: boolean;
  error?: unknown;
  onRetry: () => void;
  showDisclaimer?: boolean;
}

function statusLabel(status: AIResultStatus, copy: ReturnType<typeof xrayCopy>): string {
  if (status === "PENDING") return copy.pending;
  if (status === "PROCESSING") return copy.analyzing;
  if (status === "COMPLETED") return copy.completed;
  return copy.failed;
}

function decisionLabel(decision: AIFindingDecision | undefined, copy: ReturnType<typeof xrayCopy>): string {
  if (decision === "review") return copy.review;
  if (decision === "flagged") return copy.flagged;
  if (decision === "not_flagged") return copy.notFlagged;
  return "—";
}

function FindingScore({ finding, copy }: { finding: AIFinding; copy: XrayCopy }) {
  const score = findingScorePercent(finding);
  const threshold = findingThresholdPercent(finding);
  return <span className="xray-finding-score" dir="ltr">
    <span>{score === null ? "—" : `${score}%`}</span>
    {finding.decision === "review" && threshold !== null
      ? <small>{copy.operatingThreshold}: {threshold}%</small>
      : null}
  </span>;
}

export function AiResultPanel({ result, isLoading, error, onRetry, showDisclaimer = true }: AiResultPanelProps) {
  const language = useAuthStore((state) => state.user?.language_preference);
  const c = xrayCopy(language);
  if (isLoading) return <div className="active-xray-ai-panel"><StatePanel state="loading" title={c.loadingAiResult} /></div>;
  if (error) return <div className="active-xray-ai-panel"><StatePanel state="error" title={c.aiResultUnavailable} action={<Button variant="secondary" type="button" onClick={onRetry}>{c.retry}</Button>} /></div>;
  if (!result) return <Card><div className="active-xray-ai-panel xray-ai-empty"><h3><Sparkles size={20} aria-hidden="true" />{c.aiResult}</h3><p>{c.noResult}</p></div></Card>;

  const active = isAiAnalysisActive(result.status);
  const hasRealScores = result.findings.some((finding) => (
    typeof finding.model_score === "number" && Number.isFinite(finding.model_score)
  ));
  const disclaimer = language === "AR" ? result.disclaimer_ar : result.disclaimer;
  return <Card><div className="active-xray-ai-panel">
    <div className="section-header"><h3><Sparkles size={20} aria-hidden="true" />{c.aiResult}</h3></div>
    <div className="xray-ai-header"><StatusPill status={result.status} label={statusLabel(result.status, c)} /><span><strong>{c.status}:</strong> {statusLabel(result.status, c)}</span></div>
    {result.status === "COMPLETED" && result.overall_confidence_percent !== null
      ? <dl className="xray-ai-highlight"><div><dt>{c.overallConfidence}</dt><dd dir="ltr">{result.overall_confidence_percent}%</dd></div></dl>
      : null}
    {result.status === "COMPLETED" && result.result_summary ? <p className="xray-summary">{result.result_summary}</p> : null}
    {active ? <p className="xray-analysis-progress" role="status">{c.analyzing}</p> : null}
    {result.status === "FAILED" && result.error_message ? <p className="form-error" role="alert">{result.error_message}</p> : null}
    {result.status === "COMPLETED" ? <section className="xray-findings" aria-labelledby="xray-findings-title"><h4 id="xray-findings-title">{c.findings}</h4>
      {result.findings.length ? <div className="xray-findings-scroll"><table><thead><tr><th>{c.fdi}</th><th>{c.finding}</th><th>{c.decision}</th><th>{hasRealScores ? c.modelScore : c.confidence}</th></tr></thead><tbody>{result.findings.map((finding, index) => <tr key={`${finding.fdi_tooth_id ?? "finding"}-${index}`}><td dir="ltr">{xrayText(finding.fdi_tooth_id)}</td><td>{xrayText(finding.disease_label)}</td><td>{finding.decision ? <StatusPill className="xray-finding-decision" status={finding.decision} label={decisionLabel(finding.decision, c)} /> : "—"}</td><td><FindingScore finding={finding} copy={c} /></td></tr>)}</tbody></table></div> : <p>—</p>}
    </section> : null}
    {showDisclaimer ? <div className="ai-disclaimer" role="note"><strong>{c.researchOnly}</strong><span>{disclaimer || `${c.requiresInterpretation}. ${c.notDiagnosis}.`}</span><span>{c.modelScoresUncalibrated}.</span></div> : null}
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
    <div className="ai-disclaimer" role="note"><strong>{c.researchOnly}</strong><span>{c.requiresInterpretation}. {c.notDiagnosis}.</span><span>{c.modelScoresUncalibrated}.</span></div>
  </section>;
}
