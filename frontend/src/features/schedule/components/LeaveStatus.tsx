import type { AvailabilityException } from "../../../types/schedule";
import { useFeatureT } from "../../../layouts/i18n";

export type LeaveLifecycle = "CANCELLED" | "UPCOMING" | "IN_EFFECT" | "ENDED";

export function leaveLifecycle(item: Pick<AvailabilityException, "is_cancelled" | "start_datetime" | "end_datetime">, now = new Date()): LeaveLifecycle {
  if (item.is_cancelled) return "CANCELLED";
  if (new Date(item.end_datetime).getTime() <= now.getTime()) return "ENDED";
  if (new Date(item.start_datetime).getTime() > now.getTime()) return "UPCOMING";
  return "IN_EFFECT";
}

function Badge({ tone, label, kind }: { tone: string; label: string; kind: string }) { return <span className={`v2-status ${tone}`} aria-label={`${kind}: ${label}`}>{label}</span>; }

export function LeaveBadges({ item, now }: { item: AvailabilityException; now?: Date }) {
  const t = useFeatureT(); const lifecycle = leaveLifecycle(item, now);
  const type = item.type === "UNAVAILABLE" ? { label: t("unavailable"), tone: "warning" } : { label: t("availableOverride"), tone: "info" };
  const lifecycleMeta = { CANCELLED: { label: t("cancelled"), tone: "danger" }, UPCOMING: { label: t("upcoming"), tone: "info" }, IN_EFFECT: { label: t("inEffect"), tone: "warning" }, ENDED: { label: t("ended"), tone: "" } }[lifecycle];
  return <span className="leave-badges"><Badge kind={t("type")} {...type} /><Badge kind={t("lifecycle")} {...lifecycleMeta} /></span>;
}
