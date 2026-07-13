import { useQuery } from "@tanstack/react-query";

import { scheduleApi } from "../../api/endpoints/schedule";
import { PageHeaderV2, SectionHeading, StatePanel, StatusBadge, SurfaceCard } from "../../components/v2";
import { useAuthStore } from "../../auth/authStore";
import { useFeatureT } from "../../layouts/i18n";
import { getErrorMessage } from "../../utils/apiErrors";
import { formatClock } from "../../utils/dates";

export function OwnSchedulePage() {
  const t = useFeatureT();
  const language = useAuthStore((state) => state.user?.language_preference ?? "EN");
  const shifts = useQuery({ queryKey: ["my-working-shifts"], queryFn: () => scheduleApi.workingShifts() });
  const weekday = (day: number) => new Intl.DateTimeFormat(language === "AR" ? "ar" : "en", { weekday: "long" }).format(new Date(Date.UTC(2024, 0, 1 + day)));
  if (shifts.isLoading) return <StatePanel state="loading" title={t("loadingSchedules")} />;
  if (shifts.isError) return <StatePanel state="error" title={t("scheduleUnavailable")} description={getErrorMessage(shifts.error)} action={<button className="v2-button secondary" onClick={() => void shifts.refetch()}>{t("retry")}</button>} />;
  const rows = shifts.data?.results ?? [];
  return <div className="admin-page"><PageHeaderV2 title={t("mySchedule")} description={t("readOnlySchedule")} /><SurfaceCard major><SectionHeading title={t("currentFutureLeave")} />{!rows.length ? <StatePanel state="empty" title={t("noOwnShifts")} /> : <ul className="schedule-list">{rows.map((shift) => <li key={shift.id}><div><strong>{weekday(shift.weekday)}</strong><span className="bidi-isolate">{shift.name}</span><span><bdi>{formatClock(shift.start_time)}–{formatClock(shift.end_time)}</bdi></span></div><StatusBadge status={shift.is_active ? "ACTIVE" : "INACTIVE"} /></li>)}</ul>}</SurfaceCard></div>;
}
