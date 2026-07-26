import { useQuery } from "@tanstack/react-query";

import { scheduleApi } from "../../api/endpoints/schedule";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { LoadingState } from "../../components/LoadingState";
import { PageHeader } from "../../components/PageHeader";
import { StatusPill } from "../../components/StatusPill";
import { formatDateRange } from "../../utils/dates";
import { displayText } from "../../utils/formatters";

export function OwnLeavePage() {
  const leave = useQuery({
    queryKey: ["my-availability-exceptions"],
    queryFn: () => scheduleApi.availabilityExceptions({ page: 1 }),
  });

  if (leave.isLoading) return <LoadingState title="Loading your leave..." />;
  if (leave.isError) return <ErrorState error={leave.error} onRetry={() => void leave.refetch()} />;

  const rows = leave.data?.results ?? [];
  return (
    <div className="schedule-page">
      <PageHeader
        eyebrow="Read-only availability"
        title="My leave and unavailable periods"
        description="Admin manages leave records. Cancelled entries remain visible for operational history."
      />
      {!rows.length ? (
        <EmptyState title="No leave or unavailable periods were returned." />
      ) : (
        <ul className="schedule-list">
          {rows.map((item) => (
            <li key={item.id}>
              <div>
                <strong>{formatDateRange(item.start_datetime, item.end_datetime)}</strong>
                <span>{displayText(item.reason, "No reason recorded")}</span>
              </div>
              <StatusPill status={item.is_cancelled ? "CANCELLED" : item.type} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
