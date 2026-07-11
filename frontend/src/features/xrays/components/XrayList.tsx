import { Link } from "react-router-dom";

import { Card } from "../../../components/Card";
import { EmptyState } from "../../../components/EmptyState";
import { StatusPill } from "../../../components/StatusPill";
import type { UserRole } from "../../../types/auth";
import type { XrayAttachment } from "../../../types/xrays";
import { formatDateTime } from "../../../utils/dates";
import { displayText } from "../../../utils/formatters";
import { formatFileSize } from "../utils/xrayValidation";

interface XrayListProps { role: UserRole; xrays: XrayAttachment[]; }

export function XrayList({ role, xrays }: XrayListProps) {
  if (!xrays.length) return <EmptyState title="No saved X-rays found." />;
  return <Card><div className="table-scroll"><table className="xray-table"><thead><tr><th>X-ray</th><th>Patient</th><th>Visit</th><th>Source</th><th>Uploaded</th><th>AI</th><th /></tr></thead><tbody>
    {xrays.map((xray) => <tr key={xray.id}><td><strong>{displayText(xray.title, xray.original_file_name)}</strong><span>{xray.content_type} · {formatFileSize(xray.size_bytes)}</span></td><td>{xray.patient.full_name}</td><td>{xray.visit ? `Visit #${xray.visit.id}` : "Patient profile"}</td><td>{xray.source.replace(/_/g, " ")}</td><td>{xray.uploaded_by.full_name}<span>{formatDateTime(xray.created_at)}</span></td><td><StatusPill status={xray.has_ai_result ? "AVAILABLE" : "NOT_RUN"} /></td><td><Link className="button secondary compact-button" to={`/${role.toLowerCase()}/xrays/${xray.id}`}>Open</Link></td></tr>)}
  </tbody></table></div></Card>;
}
