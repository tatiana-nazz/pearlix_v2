import { useState } from "react";

import { Button, StatePanel, StatusBadge, SurfaceCard } from "../../../components/v2";
import { useFeatureT } from "../../../layouts/i18n";
import type { AIResult } from "../../../types/ai";
import { displayText } from "../../../utils/formatters";
import { ProtectedXrayImage } from "./ProtectedXrayImage";

interface AiResultPanelProps { result?: AIResult; isLoading: boolean; error?: unknown; overlayEndpoint: string; onRetry: () => void; }

export function AiResultPanel({ result, isLoading, error, overlayEndpoint, onRetry }: AiResultPanelProps) {
  const t = useFeatureT();
  const [showOverlay, setShowOverlay] = useState(false);
  if (isLoading) return <StatePanel state="loading" title={t("loadingXrays")} />;
  if (error) return <StatePanel state="error" title={t("aiUnavailable")} action={<Button type="button" variant="secondary" onClick={onRetry}>{t("retry")}</Button>} />;
  if (!result) return <StatePanel state="empty" title={t("noAiResult")} />;
  const heading = result.status === "COMPLETED" ? t("aiAvailable") : result.status === "FAILED" ? t("aiUnavailable") : t("runningAi");

  return <SurfaceCard className="ai-result-panel">
    <div className="ai-result-heading"><div><p className="eyebrow">{t("aiResult")}</p><h3>{heading}</h3></div><StatusBadge status={result.status} /></div>
    <div className="ai-result-summary"><p>{displayText(result.result_summary, t("noSummary"))}</p>{result.overall_confidence_percent !== null ? <strong className="bidi-isolate">{t("confidence")}: {result.overall_confidence_percent}%</strong> : null}</div>
    {result.status === "FAILED" ? <p className="form-error" role="alert">{t("aiUnavailable")}</p> : null}
    {result.findings.length ? <div className="ai-findings"><p className="eyebrow">{t("finding")}</p><ul>{result.findings.map((finding, index) => <li key={`${finding.fdi_tooth_id ?? "finding"}-${index}`}><strong>{displayText(finding.disease_label, t("finding"))}</strong><span className="bidi-isolate">{t("tooth")}: {displayText(finding.fdi_tooth_id, t("notSpecified"))} · {t("confidence")}: {finding.confidence_percent ?? t("notReported")}{finding.confidence_percent !== undefined ? "%" : ""}</span></li>)}</ul></div> : null}
    <div className="ai-disclaimer" role="note"><strong>{t("researchDisclaimer")}</strong><p>{result.disclaimer}</p>{result.disclaimer_ar ? <p lang="ar" dir="rtl">{result.disclaimer_ar}</p> : null}</div>
    {result.overlay_available ? <div className="ai-overlay-controls"><Button type="button" variant={showOverlay ? "primary" : "secondary"} onClick={() => setShowOverlay((visible) => !visible)} aria-pressed={showOverlay}>{showOverlay ? t("originalXray") : t("aiOverlay")}</Button>{showOverlay ? <ProtectedXrayImage endpoint={overlayEndpoint} label={t("aiOverlay")} alt={t("aiOverlay")} /> : null}</div> : null}
  </SurfaceCard>;
}
