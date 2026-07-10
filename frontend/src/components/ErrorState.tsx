import { getErrorMessage } from "../utils/apiErrors";

interface ErrorStateProps {
  error: unknown;
  onRetry?: () => void;
  title?: string;
}

export function ErrorState({ error, onRetry, title = "Unable to load dashboard" }: ErrorStateProps) {
  return (
    <div className="state-panel error-state" role="alert">
      <div>
        <h3>{title}</h3>
        <p>{getErrorMessage(error)}</p>
      </div>
      {onRetry ? (
        <button className="button secondary" type="button" onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  );
}
