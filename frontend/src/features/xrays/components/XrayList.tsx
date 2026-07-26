import { ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useAuthStore } from "../../../auth/authStore";
import { Card } from "../../../components/Card";
import { EmptyState } from "../../../components/EmptyState";
import { StatusPill } from "../../../components/StatusPill";
import type { UserRole } from "../../../types/auth";
import type { XrayAttachment } from "../../../types/xrays";
import { formatDateTime } from "../../../utils/dates";
import { formatFileSize } from "../utils/xrayValidation";
import { xrayCopy } from "../i18n";
import { aiStatusLabel, xraySourceLabel, xrayText } from "../utils/xrayPresentation";

interface XrayListProps { role: UserRole; xrays: XrayAttachment[]; }

function rowKeyboardOpen(event: React.KeyboardEvent<HTMLTableRowElement>, open: () => void) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    open();
  }
}

export function XrayList({ role, xrays }: XrayListProps) {
  const navigate = useNavigate();
  const c = xrayCopy(useAuthStore((state) => state.user?.language_preference));
  if (!xrays.length) return <EmptyState title={c.noXrays} />;
  return <Card><div className="table-scroll"><table className="xray-table"><thead><tr><th>X-ray</th><th>Patient</th><th>Related visit</th><th>Uploaded</th><th>AI result</th><th aria-label="Open" /></tr></thead><tbody>
    {xrays.map((xray) => {
      const open = () => navigate(`/${role.toLowerCase()}/xrays/${xray.id}`);
      const label = `${xrayText(xray.title || xray.original_file_name)}. ${xray.patient.full_name}. ${aiStatusLabel(xray.has_ai_result)}.`;
      return <tr key={xray.id} className="clickable-row" tabIndex={0} aria-label={label} onClick={open} onKeyDown={(event) => rowKeyboardOpen(event, open)}>
        <td><strong>{xrayText(xray.title || xray.original_file_name)}</strong><span className="table-secondary-text" dir="ltr">{xray.content_type} · {formatFileSize(xray.size_bytes)}</span></td>
        <td>{xray.patient.full_name}</td>
        <td>{xray.visit ? `${xraySourceLabel(xray.source)} · ${formatDateTime(xray.visit.started_at)}` : xraySourceLabel(xray.source)}</td>
        <td>{xray.uploaded_by.full_name}<span dir="ltr">{formatDateTime(xray.created_at)}</span></td>
        <td><StatusPill status={xray.has_ai_result ? "AVAILABLE" : "NOT_RUN"} /></td>
        <td aria-hidden="true"><ChevronRight size={18} /></td>
      </tr>;
    })}
  </tbody></table></div></Card>;
}
