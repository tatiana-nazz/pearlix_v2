import { StatusBadge } from "./v2";

interface StatusPillProps {
  status: string;
  tone?: "default" | "attention" | "success" | "danger";
}

export function StatusPill({ status }: StatusPillProps) {
  return <StatusBadge status={status} />;
}
