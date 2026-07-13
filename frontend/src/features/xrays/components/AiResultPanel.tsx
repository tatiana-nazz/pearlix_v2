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
  return <SurfaceCard><div className="section-header"><h3>{t("aiResult")}</h3><p>{t("researchDisclaimer")}</p></div>
    <div className="xray-ai-header"><StatusBadge status={result.status} />{result.overall_confidence_percent !== null ? <strong className="bidi-isolate">{t("confidence")}: {result.overall_confidence_percent}%</strong> : null}</div>
    <p className="xray-summary">{displayText(result.result_summary, t("noSummary"))}</p>
    {result.status === "FAILED" ? <p className="form-error" role="alert">{t("aiUnavailable")}</p> : null}
    {result.findings.length ? <ul className="summary-list-flat">{result.findings.map((finding, index) => <li className="summary-row" key={`${finding.fdi_tooth_id ?? "finding"}-${index}`}><div><strong>{displayText(finding.disease_label, t("finding"))}</strong><span className="bidi-isolate">{t("tooth")}: {displayText(finding.fdi_tooth_id, t("notSpecified"))} · {t("confidence")}: {finding.confidence_percent ?? t("notReported")}{finding.confidence_percent !== undefined ? "%" : ""}</span></div></li>)}</ul> : null}
    <div className="ai-disclaimer" role="note"><p>{result.disclaimer}</p>{result.disclaimer_ar ? <p lang="ar" dir="rtl">{result.disclaimer_ar}</p> : null}</div>
    {result.overlay_available ? <><Button type="button" variant="secondary" onClick={() => setShowOverlay((visible) => !visible)}>{showOverlay ? t("originalXray") : t("aiOverlay")}</Button>{showOverlay ? <ProtectedXrayImage endpoint={overlayEndpoint} label={t("aiOverlay")} alt={t("aiOverlay")} /> : null}</> : null}
  </SurfaceCard>;
}
