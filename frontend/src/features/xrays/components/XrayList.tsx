import { useNavigate } from "react-router-dom";

import { DataTableShell, StatusBadge } from "../../../components/v2";
import { useFeatureT } from "../../../layouts/i18n";
import type { UserRole } from "../../../types/auth";
import type { XrayAttachment } from "../../../types/xrays";
import { formatDateTime } from "../../../utils/dates";
import { displayText } from "../../../utils/formatters";
import { formatFileSize } from "../utils/xrayValidation";

export function XrayList({ role, xrays }: { role: UserRole; xrays: XrayAttachment[] }) {
  const t = useFeatureT(); const navigate = useNavigate();
  if (!xrays.length) return <DataTableShell title={t("savedXrays")} state={<p>{t("noSavedXrays")}</p>} />;
  function open(xray: XrayAttachment) { navigate(`/${role.toLowerCase()}/xrays/${xray.id}`); }
  return <DataTableShell title={t("savedXrays")}><table className="xray-table"><thead><tr><th>{t("savedXrays")}</th><th>{t("patient")}</th><th>{t("visitContext")}</th><th>{t("source")}</th><th>{t("uploaded")}</th><th>AI</th></tr></thead><tbody>{xrays.map((xray) => <tr className="v2-clickable-row" key={xray.id} tabIndex={0} onClick={() => open(xray)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(xray); } }}><td><strong className="bidi-isolate">{displayText(xray.title, xray.original_file_name)}</strong><span className="bidi-isolate">{xray.content_type} · {formatFileSize(xray.size_bytes)}</span></td><td className="bidi-isolate">{xray.patient.full_name}</td><td className="bidi-isolate">{xray.visit ? `${formatDateTime(xray.visit.started_at)}` : t("patientProfileSource")}</td><td>{xray.source === "ACTIVE_VISIT" ? t("activeVisit") : xray.source === "PATIENT_PROFILE" ? t("patientProfileSource") : t("externalWorkspace")}</td><td><span>{xray.uploaded_by.full_name}</span><span className="bidi-isolate">{formatDateTime(xray.created_at)}</span></td><td><span>{xray.has_ai_result ? t("aiAvailable") : t("aiNotRun")}</span></td></tr>)}</tbody></table></DataTableShell>;
}
