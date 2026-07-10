interface LoadingStateProps {
  title?: string;
}

export function LoadingState({ title = "Loading dashboard data..." }: LoadingStateProps) {
  return (
    <div className="state-panel loading-state" role="status">
      <span />
      <p>{title}</p>
    </div>
  );
}
