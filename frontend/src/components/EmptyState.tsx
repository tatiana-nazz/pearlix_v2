interface EmptyStateProps {
  title?: string;
}

export function EmptyState({ title = "No records found." }: EmptyStateProps) {
  return <StatePanel state="empty" title={title} />;
}
import { StatePanel } from "./v2";
