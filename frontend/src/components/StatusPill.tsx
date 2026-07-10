type StatusTone = "default" | "attention" | "success" | "danger";

function toneForStatus(status: string): StatusTone {
  if (["NEEDS_RESCHEDULE", "UNPAID", "PARTIALLY_PAID", "PENDING"].includes(status)) return "attention";
  if (["COMPLETED", "PAID", "CONVERTED_TO_INVOICE"].includes(status)) return "success";
  if (["CANCELLED", "NO_SHOW", "FAILED", "DISMISSED"].includes(status)) return "danger";
  return "default";
}

interface StatusPillProps {
  status: string;
  tone?: StatusTone;
}

export function StatusPill({ status, tone }: StatusPillProps) {
  return <span className={`status-pill ${tone ?? toneForStatus(status)}`}>{status.split("_").join(" ")}</span>;
}
