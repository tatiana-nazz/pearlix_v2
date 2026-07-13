import { useState } from "react";
import { Link } from "react-router-dom";

import { useAuthStore } from "../../../auth/authStore";
import { Button, StatePanel, SurfaceCard } from "../../../components/v2";
import { useFeatureT } from "../../../layouts/i18n";
import type { UserRole } from "../../../types/auth";
import type { VisitDetail } from "../../../types/visits";
import { useBillingMutations, useHandoffs } from "../hooks/useBilling";
import { CreateHandoffDialog } from "./BillingDialogs";

export function VisitBillingSection({ role, visit }: { role: UserRole; visit: VisitDetail }) {
  const t = useFeatureT();
  const user = useAuthStore((state) => state.user);
  const handoffs = useHandoffs({ visit_id: visit.id });
  const mutations = useBillingMutations();
  const [open, setOpen] = useState(false);
  const allowed = role === "DOCTOR" && user?.id === visit.doctor.id && visit.status === "COMPLETED";
  const existing = handoffs.data?.results[0];
  return <SurfaceCard><h3>{t("billingHandoff")}</h3><p>{allowed ? t("createHandoffGuidance") : t("handoffVisibilityGuidance")}</p>{handoffs.isLoading ? <StatePanel state="loading" title={t("loadingHandoff")} /> : null}{handoffs.isError ? <StatePanel state="error" title={t("handoffUnavailable")} action={<Button onClick={() => void handoffs.refetch()}>{t("retry")}</Button>} /> : null}{existing ? <Link className="v2-button secondary" to={`/${role.toLowerCase()}/billing/handoffs/${existing.id}`}>{t("openHandoff")}</Link> : null}{allowed && !existing ? <Button variant="secondary" onClick={() => { mutations.createHandoff.reset(); setOpen(true); }}>{t("createHandoff")}</Button> : null}{open ? <CreateHandoffDialog pending={mutations.createHandoff.isPending} error={mutations.createHandoff.error} onCancel={() => setOpen(false)} onSubmit={(payload) => { void mutations.createHandoff.mutateAsync({ visitId: visit.id, payload }).then(() => setOpen(false)); }} /> : null}</SurfaceCard>;
}
