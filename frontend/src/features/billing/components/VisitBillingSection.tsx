import { useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "../../../components/Card";
import { ErrorState } from "../../../components/ErrorState";
import { SectionHeader } from "../../../components/SectionHeader";
import { useAuthStore } from "../../../auth/authStore";
import type { UserRole } from "../../../types/auth";
import type { VisitDetail } from "../../../types/visits";
import { useBillingMutations, useHandoffs } from "../hooks/useBilling";
import { CreateHandoffDialog } from "./BillingDialogs";
import { visitCopy } from "../../visits/i18n";

export function VisitBillingSection({ role, visit }: { role: UserRole; visit: VisitDetail }) {
  const user = useAuthStore((state) => state.user); const c = visitCopy(user?.language_preference); const handoffs = useHandoffs({ visit_id: visit.id }); const mutations = useBillingMutations(); const [open, setOpen] = useState(false);
  const ownCompleted = role === "DOCTOR" && user?.id === visit.doctor.id && visit.status === "COMPLETED";
  const existing = handoffs.data?.results[0];
  return <Card><SectionHeader title={c.billingTitle} description={ownCompleted ? c.billingEligible : c.billingVisibility} />
    {existing ? <Link className="visit-record-link" to={`/${role.toLowerCase()}/billing/handoffs/${existing.id}`}>{existing.patient.full_name} <span>{c.billingStatus}: {existing.status}</span></Link> : null}
    {ownCompleted && !existing ? <button className="button secondary" type="button" onClick={() => { mutations.createHandoff.reset(); setOpen(true); }}>{c.createBillingHandoff}</button> : null}
    {handoffs.error ? <ErrorState error={handoffs.error} title={c.loadBillingError} /> : null}
    {open ? <CreateHandoffDialog pending={mutations.createHandoff.isPending} error={mutations.createHandoff.error} onCancel={() => setOpen(false)} onSubmit={(payload) => void mutations.createHandoff.mutateAsync({ visitId: visit.id, payload }).then(() => setOpen(false))} /> : null}
  </Card>;
}
