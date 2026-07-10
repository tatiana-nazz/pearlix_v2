interface EmptyStateProps {
  title?: string;
}

export function EmptyState({ title = "No records found." }: EmptyStateProps) {
  return <p className="empty-state">{title}</p>;
}
