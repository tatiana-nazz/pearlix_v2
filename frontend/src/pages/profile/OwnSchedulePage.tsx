import { useQuery } from "@tanstack/react-query";
import { scheduleApi } from "../../api/endpoints/schedule";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { LoadingState } from "../../components/LoadingState";
import { PageHeader } from "../../components/PageHeader";
import { StatusPill } from "../../components/StatusPill";
import { formatClock, formatWeekday } from "../../utils/dates";

export function OwnSchedulePage() {
  const shifts = useQuery({ queryKey: ["my-working-shifts"], queryFn: () => scheduleApi.workingShifts() });
  if (shifts.isLoading) return <LoadingState title="Loading your schedule..." />;
  if (shifts.isError) return <ErrorState error={shifts.error} onRetry={() => void shifts.refetch()} />;
  const rows = shifts.data?.results ?? [];
  return <div className="schedule-page"><PageHeader eyebrow="Read-only schedule" title="My working schedule" description="Admin controls assigned shifts. Times use the clinic timezone." />{!rows.length ? <EmptyState title="No working shifts have been assigned." /> : <div className="weekly-board">{rows.map((shift) => <div className="shift-card" key={shift.id}><strong>{formatWeekday(shift.weekday)}</strong><span>{shift.name}</span><span>{formatClock(shift.start_time)} - {formatClock(shift.end_time)}</span><StatusPill status={shift.is_active ? "ACTIVE" : "INACTIVE"} /></div>)}</div>}</div>;
}
