import { useQuery } from "@tanstack/react-query";

import { scheduleApi } from "../../api/endpoints/schedule";
import { Button, SectionHeading, StatePanel, StatusBadge, SurfaceCard } from "../../components/v2";
import { useAuthStore } from "../../auth/authStore";
import { useFeatureT } from "../../layouts/i18n";
import { getErrorMessage } from "../../utils/apiErrors";
import { formatClock } from "../../utils/dates";

export function OwnSchedulePage({ embedded = false }: { embedded?: boolean }) {
  const t = useFeatureT();
  const language = useAuthStore((state) => state.user?.language_preference ?? "EN");
  const shifts = useQuery({ queryKey: ["my-working-shifts"], queryFn: () => scheduleApi.workingShifts() });
  const weekday = (day: number) => new Intl.DateTimeFormat(language === "AR" ? "ar" : "en", { weekday: "long" }).format(new Date(Date.UTC(2024, 0, 1 + day)));
  if (shifts.isLoading) return <StatePanel state="loading" title={t("loadingSchedules")} />;
  if (shifts.isError) return <StatePanel state="error" title={t("scheduleUnavailable")} description={getErrorMessage(shifts.error)} action={<Button type="button" variant="secondary" onClick={() => void shifts.refetch()}>{t("retry")}</Button>} />;
  const rows = shifts.data?.results ?? [];
  const content = <SurfaceCard major><SectionHeading title={t("mySchedule")} />{!rows.length ? <StatePanel state="empty" title={t("noOwnShifts")} /> : <ul className="schedule-list">{rows.map((shift) => <li key={shift.id}><div><strong>{weekday(shift.weekday)}</strong><span className="bidi-isolate">{shift.name}</span><span><bdi>{formatClock(shift.start_time)}–{formatClock(shift.end_time)}</bdi></span></div><StatusBadge status={shift.is_active ? "ACTIVE" : "INACTIVE"} /></li>)}</ul>}</SurfaceCard>;
  return embedded ? content : <div className="admin-page">{content}</div>;
}
