import { useNavigate } from "react-router-dom";

import { DataTableShell, StatusBadge } from "../../../components/v2";
import { useFeatureT } from "../../../layouts/i18n";
import type { UserRole } from "../../../types/auth";
import type { XrayAttachment } from "../../../types/xrays";
import { formatDateTime } from "../../../utils/dates";
import { displayText } from "../../../utils/formatters";
import { formatFileSize } from "../utils/xrayValidation";

export function XrayList({ role, xrays }: { role: UserRole; xrays: XrayAttachment[] }) {
  const t = useFeatureT();
  const navigate = useNavigate();
  if (!xrays.length) return <DataTableShell title={t("savedXrays")} state={<p>{t("noSavedXrays")}</p>} />;

  return <DataTableShell title={t("savedXrays")}>
    <div className="xray-gallery" role="list">
      {xrays.map((xray) => {
        const source = xray.source === "ACTIVE_VISIT" ? t("activeVisit") : xray.source === "PATIENT_PROFILE" ? t("patientProfileSource") : t("externalWorkspace");
        const aiStatus = xray.has_ai_result ? t("aiAvailable") : t("aiNotRun");
        const name = displayText(xray.title, xray.original_file_name);
        return <button className="xray-gallery-card" key={xray.id} type="button" role="listitem" onClick={() => navigate(`/${role.toLowerCase()}/xrays/${xray.id}`)} aria-label={`${t("openXray")}: ${name}`}>
          <span className="xray-gallery-card-top"><span className="xray-media-mark" aria-hidden="true">XR</span><span><strong className="bidi-isolate">{name}</strong><small className="bidi-isolate">{xray.content_type} · {formatFileSize(xray.size_bytes)}</small></span><StatusBadge status={xray.has_ai_result ? "COMPLETED" : "PENDING"} /></span>
          <span className="xray-gallery-patient"><small>{t("patient")}</small><bdi>{xray.patient.full_name}</bdi></span>
          <span className="xray-gallery-meta"><span><small>{t("visitContext")}</small><bdi>{xray.visit ? formatDateTime(xray.visit.started_at) : t("patientProfileSource")}</bdi></span><span><small>{t("uploaded")}</small><bdi>{formatDateTime(xray.created_at)}</bdi></span></span>
          <span className="xray-gallery-footer"><span>{source}</span><span>{aiStatus}</span></span>
        </button>;
      })}
    </div>
  </DataTableShell>;
}
