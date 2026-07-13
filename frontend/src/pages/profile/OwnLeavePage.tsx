import { useQuery } from "@tanstack/react-query";

import { scheduleApi } from "../../api/endpoints/schedule";
import { PageHeaderV2, SectionHeading, StatePanel, StatusBadge, SurfaceCard } from "../../components/v2";
import { useAuthStore } from "../../auth/authStore";
import { useFeatureT } from "../../layouts/i18n";
import { getErrorMessage } from "../../utils/apiErrors";
import { formatDateRange } from "../../utils/dates";

export function OwnLeavePage() {
  const t = useFeatureT();
  const user = useAuthStore((state) => state.user);
  const leave = useQuery({ queryKey: ["my-availability-exceptions", user?.id], queryFn: () => scheduleApi.availabilityExceptions({ page: 1, start_from: new Date().toISOString(), is_cancelled: "false", ...(user?.role === "STAFF" ? { staff_id: user.id } : {}) }), enabled: Boolean(user) });
  if (leave.isLoading) return <StatePanel state="loading" title={t("loadingLeave")} />;
  if (leave.isError) return <StatePanel state="error" title={t("leaveUnavailable")} description={getErrorMessage(leave.error)} action={<button className="v2-button secondary" onClick={() => void leave.refetch()}>{t("retry")}</button>} />;
  const rows = leave.data?.results ?? [];
  return <div className="admin-page"><PageHeaderV2 title={t("myLeave")} description={t("readOnlyLeave")} /><SurfaceCard major><SectionHeading title={t("currentFutureLeave")} />{!rows.length ? <StatePanel state="empty" title={t("noLeave")} /> : <ul className="schedule-list">{rows.map((item) => <li key={item.id}><div><strong><bdi>{formatDateRange(item.start_datetime, item.end_datetime)}</bdi></strong><span className="bidi-isolate">{item.reason || t("noReason")}</span></div><StatusBadge status={item.is_cancelled ? "CANCELLED" : item.type === "UNAVAILABLE" ? "PENDING" : "ACTIVE"} /></li>)}</ul>}</SurfaceCard></div>;
}
