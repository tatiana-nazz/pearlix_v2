import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";

import { scheduleApi } from "../../api/endpoints/schedule";
import { Button, Pagination, SectionHeading, StatePanel, SurfaceCard } from "../../components/v2";
import { LeaveBadges } from "../../features/schedule/components/LeaveStatus";
import { useAuthStore } from "../../auth/authStore";
import { useFeatureT } from "../../layouts/i18n";
import { getErrorMessage } from "../../utils/apiErrors";
import { formatDateRange } from "../../utils/dates";

export function OwnLeavePage({ embedded = false }: { embedded?: boolean }) {
  const t = useFeatureT();
  const user = useAuthStore((state) => state.user);
  const [params, setParams] = useSearchParams(); const page = Math.max(1, Number(params.get("page") ?? "1"));
  const leave = useQuery({ queryKey: ["my-availability-exceptions", user?.id, page], queryFn: () => scheduleApi.availabilityExceptions({ page, start_from: new Date().toISOString(), is_cancelled: "false", ...(user?.role === "STAFF" ? { staff_id: user.id } : {}) }), enabled: Boolean(user), placeholderData: (previous) => previous });
  if (leave.isLoading) return <StatePanel state="loading" title={t("loadingLeave")} />;
  if (leave.isError) return <StatePanel state="error" title={t("leaveUnavailable")} description={getErrorMessage(leave.error)} action={<Button type="button" variant="secondary" onClick={() => void leave.refetch()}>{t("retry")}</Button>} />;
  const rows = leave.data?.results ?? [];
  const content = <><SurfaceCard major><SectionHeading title={t("myLeave")} />{!rows.length ? <StatePanel state="empty" title={t("noLeave")} /> : <ul className="schedule-list leave-own-list">{rows.map((item) => <li key={item.id}><div><strong><bdi>{formatDateRange(item.start_datetime, item.end_datetime)}</bdi></strong><span className="bidi-isolate">{item.reason || t("noReason")}</span></div><LeaveBadges item={item} /></li>)}</ul>}</SurfaceCard>{leave.data ? <Pagination page={page} hasPrevious={Boolean(leave.data.previous)} hasNext={Boolean(leave.data.next)} onPrevious={() => setParams({ page: String(page - 1) })} onNext={() => setParams({ page: String(page + 1) })} /> : null}</>;
  return embedded ? content : <div className="admin-page">{content}</div>;
}
