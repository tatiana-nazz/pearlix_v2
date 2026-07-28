import { Sparkles } from "lucide-react";

import { Card } from "../../../components/Card";
import { Button, StatePanel, StatusBadge } from "../../../components/v2";
import { useFeatureT } from "../../../layouts/i18n";
import type { AIResult } from "../../../types/ai";
import { formatDateTime } from "../../../utils/dates";
import { displayText } from "../../../utils/formatters";
import { ProtectedXrayImage } from "./ProtectedXrayImage";

interface AiResultPanelProps {
  result?: AIResult;
  isLoading: boolean;
  error?: unknown;
  overlayEndpoint?: string;
  onRetry: () => void;
}

export function AiResultPanel({ result, isLoading, error, overlayEndpoint, onRetry }: AiResultPanelProps) {
  const t = useFeatureT();
  if (isLoading) return <div className="active-xray-ai-panel"><StatePanel state="loading" title={t("loadingAiResult")} /></div>;
  if (error) return <div className="active-xray-ai-panel"><StatePanel state="error" title={t("aiResultUnavailable")} action={<Button variant="secondary" type="button" onClick={onRetry}>{t("retry")}</Button>} /></div>;
  if (!result) return <Card><div className="active-xray-ai-panel xray-ai-empty"><h3><Sparkles size={20} aria-hidden="true" />{t("aiResult")}</h3><p>{t("noStoredAiResult")}</p></div></Card>;

  return <Card><div className="active-xray-ai-panel">
    <div className="section-header"><h3><Sparkles size={20} aria-hidden="true" />{t("aiResult")}</h3></div>
    <div className="xray-ai-header"><StatusBadge status={result.status} /></div>
    <dl className="xray-ai-highlight"><div><dt>{t("overallConfidence")}</dt><dd dir="ltr">{result.overall_confidence_percent === null ? "—" : `${result.overall_confidence_percent}%`}</dd></div></dl>
    {result.result_summary ? <p className="xray-summary">{result.result_summary}</p> : null}
    {result.status === "FAILED" && result.error_message ? <p className="form-error" role="alert">{result.error_message}</p> : null}
    <section className="xray-findings"><h4>{t("findings")}</h4>{result.findings.length ? <div className="xray-findings-scroll"><table><thead><tr><th>FDI</th><th>{t("finding")}</th><th>{t("confidence")}</th></tr></thead><tbody>{result.findings.map((finding, index) => <tr key={`${finding.fdi_tooth_id ?? "finding"}-${index}`}><td dir="ltr">{displayText(finding.fdi_tooth_id, "—")}</td><td>{displayText(finding.disease_label, "—")}</td><td dir="ltr">{finding.confidence_percent === undefined ? "—" : `${finding.confidence_percent}%`}</td></tr>)}</tbody></table></div> : <p>—</p>}</section>
    {overlayEndpoint && result.overlay_available ? <ProtectedXrayImage endpoint={overlayEndpoint} label={t("aiOverlay")} alt={t("aiOverlay")} /> : null}
  </div></Card>;
}

export function AiAnalysisDetails({ result }: { result?: AIResult }) {
  const t = useFeatureT();
  return <section className="active-xray-analysis-details" aria-labelledby="active-xray-analysis-details-title"><h4 id="active-xray-analysis-details-title">{t("aiAnalysisDetails")}</h4>{result ? <dl className="xray-ai-metadata"><div><dt>{t("modelVersion")}</dt><dd dir="ltr">{displayText(result.model_version, "—")}</dd></div><div><dt>{t("created")}</dt><dd dir="ltr">{formatDateTime(result.created_at) || "—"}</dd></div><div><dt>{t("updated")}</dt><dd dir="ltr">{formatDateTime(result.updated_at) || "—"}</dd></div><div><dt>{t("overlayAvailability")}</dt><dd>{result.overlay_available ? t("overlayAvailable") : t("overlayNotAvailable")}</dd></div></dl> : null}<div className="ai-disclaimer" role="note"><strong>{t("researchOnly")}</strong><span>{t("researchDisclaimer")}</span></div></section>;
}
