interface LoadingStateProps {
  title?: string;
}

export function LoadingState({ title = "Loading dashboard data..." }: LoadingStateProps) {
  return <StatePanel state="loading" title={title} action={<Skeleton height={12} />} />;
}
import { Skeleton, StatePanel } from "./v2";
