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

export function VisitBillingSection({ role, visit }: { role: UserRole; visit: VisitDetail }) {
  const user = useAuthStore((state) => state.user); const handoffs = useHandoffs({ visit_id: visit.id }); const mutations = useBillingMutations(); const [open, setOpen] = useState(false);
  const ownCompleted = role === "DOCTOR" && user?.id === visit.doctor.id && visit.status === "COMPLETED";
  const existing = handoffs.data?.results[0];
  return <Card><SectionHeader title="Billing handoff" description={ownCompleted ? "Create one handoff when the completed clinical visit is ready for Staff billing." : "Billing handoff visibility follows your backend role permissions."} />
    {existing ? <Link className="button secondary" to={`/${role.toLowerCase()}/billing/handoffs/${existing.id}`}>Open handoff ({existing.status})</Link> : null}
    {ownCompleted && !existing ? <button className="button secondary" type="button" onClick={() => { mutations.createHandoff.reset(); setOpen(true); }}>Create Billing Handoff</button> : null}
    {handoffs.error ? <ErrorState error={handoffs.error} title="Unable to load billing handoff" /> : null}
    {open ? <CreateHandoffDialog pending={mutations.createHandoff.isPending} error={mutations.createHandoff.error} onCancel={() => setOpen(false)} onSubmit={(payload) => void mutations.createHandoff.mutateAsync({ visitId: visit.id, payload }).then(() => setOpen(false))} /> : null}
  </Card>;
}
