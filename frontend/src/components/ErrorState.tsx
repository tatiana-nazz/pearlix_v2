import { getErrorMessage } from "../utils/apiErrors";

interface ErrorStateProps {
  error: unknown;
  onRetry?: () => void;
}

export function ErrorState({ error, onRetry }: ErrorStateProps) {
  return (
    <div className="state-panel error-state" role="alert">
      <div>
        <h3>Unable to load dashboard</h3>
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
