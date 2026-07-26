import { StatusBadge } from "../../../components/v2";
import { formatDateRange } from "../../../utils/dates";
import { displayText } from "../../../utils/formatters";

export interface LeaveExceptionLike {
  id: number;
  start_datetime: string;
  end_datetime: string;
  type: string;
  reason: string;
  is_cancelled: boolean;
}

export function LeaveExceptionsTable({ items, language, emptyText, noReason }: { items: LeaveExceptionLike[]; language: "EN" | "AR"; emptyText: string; noReason: string }) {
  if (!items.length) return <p className="panel-note">{emptyText}</p>;
  const sorted = [...items].sort((a, b) => a.start_datetime.localeCompare(b.start_datetime));
  return <div className="leave-table-scroll"><table className="leave-exceptions-table"><thead><tr><th>{language === "AR" ? "التاريخ / الوقت" : "Date / Time"}</th><th>{language === "AR" ? "السبب" : "Reason"}</th><th>{language === "AR" ? "النوع" : "Type"}</th><th>{language === "AR" ? "الحالة" : "Status"}</th></tr></thead><tbody>{sorted.map((item) => {
    const machineStatus = item.is_cancelled ? "CANCELLED" : "ACTIVE";
    const statusLabel = item.is_cancelled ? (language === "AR" ? "ملغاة" : "Cancelled") : (language === "AR" ? "نشطة" : "Active");
    const typeLabel = item.type === "AVAILABLE_OVERRIDE" ? (language === "AR" ? "استثناء متاح" : "Available override") : (language === "AR" ? "غير متاح" : "Unavailable");
    return <tr key={item.id}><td>{formatDateRange(item.start_datetime, item.end_datetime)}</td><td>{displayText(item.reason, noReason)}</td><td>{typeLabel}</td><td><StatusBadge status={machineStatus} label={statusLabel} /></td></tr>;
  })}</tbody></table></div>;
}
