import { getErrorMessage } from "../utils/apiErrors";
import { Button, StatePanel } from "./v2";

interface ErrorStateProps {
  error: unknown;
  onRetry?: () => void;
  title?: string;
}

export function ErrorState({ error, onRetry, title = "Unable to load dashboard" }: ErrorStateProps) {
  return <StatePanel state="error" title={title} description={getErrorMessage(error)} action={onRetry ? <Button variant="secondary" type="button" onClick={onRetry}>Retry</Button> : null} />;
}
