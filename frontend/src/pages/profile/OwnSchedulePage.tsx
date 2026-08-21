import { useQuery } from "@tanstack/react-query";
import { clinicApi, clinicSettingsQueryKey } from "../../api/endpoints/clinic";
import { scheduleApi } from "../../api/endpoints/schedule";
import { useAuthStore } from "../../auth/authStore";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { LoadingState } from "../../components/LoadingState";
import { PageHeader } from "../../components/PageHeader";
import { ScheduleMatrix } from "../../features/schedule/components/ScheduleMatrix";

export function OwnSchedulePage() {
  const language = useAuthStore((state) => state.user?.language_preference ?? "EN");
  const shifts = useQuery({ queryKey: ["my-working-shifts"], queryFn: () => scheduleApi.workingShifts() });
  const clinicSettings = useQuery({ queryKey: clinicSettingsQueryKey, queryFn: clinicApi.getSettings, staleTime: 300_000 });
  if (shifts.isLoading) return <LoadingState title="Loading your schedule..." />;
  if (shifts.isError) return <ErrorState error={shifts.error} onRetry={() => void shifts.refetch()} />;
  const rows = shifts.data?.results ?? [];
  return <div className="schedule-page"><PageHeader eyebrow="Read-only schedule" title="My working schedule" description="Admin controls assigned shifts. Times use the clinic timezone." />{!rows.length ? <EmptyState title="No working shifts have been assigned." /> : <ScheduleMatrix shifts={rows} language={language} emptyText="No working shifts have been assigned." weeklyClosedDays={clinicSettings.data?.weekly_closed_days} />}</div>;
}
