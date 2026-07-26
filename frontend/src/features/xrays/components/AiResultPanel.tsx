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
  if (isLoading) return <StatePanel state="loading" title="Loading AI result…" />;
  if (error) return <StatePanel state="error" title="AI result unavailable" action={<Button variant="secondary" type="button" onClick={onRetry}>Retry</Button>} />;
  if (!result) return <Card><div className="xray-ai-empty"><h3>{c.aiResult}</h3><p>{c.noResult}</p><p>{c.unavailable}</p></div></Card>;

  const status = result.status === "PROCESSING" || result.status === "PENDING" ? c.processing : result.status === "FAILED" ? c.failed : result.status;
  return <Card><div className="section-header"><h3>{c.aiResult}</h3><p>{c.disclaimer}</p></div>
    <div className="xray-ai-header"><StatusPill status={result.status} /><span><strong>{c.status}:</strong> {status}</span>{result.overall_confidence_percent !== null ? <span dir="ltr"><strong>{c.confidence}:</strong> {result.overall_confidence_percent}%</span> : null}</div>
    {result.result_summary ? <p className="xray-summary">{result.result_summary}</p> : null}
    {result.status === "FAILED" && result.error_message ? <p className="form-error" role="alert">{result.error_message}</p> : null}
    {result.findings.length ? <section className="xray-findings" aria-labelledby="xray-findings-title"><h4 id="xray-findings-title">{c.findings}</h4><ul className="summary-list-flat">{result.findings.map((finding, index) => <li className="summary-row" key={`${finding.fdi_tooth_id ?? "finding"}-${index}`}><div><strong>{xrayText(finding.disease_label)}</strong><span dir="ltr">{xrayText(finding.fdi_tooth_id)} · {finding.confidence_percent === undefined ? "—" : `${finding.confidence_percent}%`}</span></div></li>)}</ul></section> : null}
    <dl className="xray-ai-metadata"><div><dt>{c.model}</dt><dd dir="ltr">{xrayText(result.model_version)}</dd></div><div><dt>{c.uploaded}</dt><dd dir="ltr">{formatDateTime(result.created_at) || "—"}</dd></div><div><dt>{c.updated}</dt><dd dir="ltr">{formatDateTime(result.updated_at) || "—"}</dd></div></dl>
    <div className="ai-disclaimer" role="note"><p>{result.disclaimer || c.disclaimer}</p>{result.disclaimer_ar ? <p lang="ar" dir="rtl">{result.disclaimer_ar}</p> : null}</div>
  </Card>;
}
