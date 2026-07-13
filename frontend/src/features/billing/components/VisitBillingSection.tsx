import { useState } from "react";
import { Link } from "react-router-dom";
import { Button, StatePanel, SurfaceCard } from "../../../components/v2";
import { useAuthStore } from "../../../auth/authStore";
import type { UserRole } from "../../../types/auth";
import type { VisitDetail } from "../../../types/visits";
import { useBillingMutations, useHandoffs } from "../hooks/useBilling";
import { CreateHandoffDialog } from "./BillingDialogs";

export function VisitBillingSection({ role, visit }: { role: UserRole; visit: VisitDetail }) { const user = useAuthStore((state) => state.user); const handoffs = useHandoffs({ visit_id: visit.id }); const mutations = useBillingMutations(); const [open, setOpen] = useState(false); const allowed = role === "DOCTOR" && user?.id === visit.doctor.id && visit.status === "COMPLETED"; const existing = handoffs.data?.results[0]; return <SurfaceCard><h3>Billing handoff</h3><p>{allowed ? "Create a single pending handoff when this completed visit is ready for Staff billing." : "Billing handoff visibility follows your role and visit ownership."}</p>{handoffs.isLoading ? <StatePanel state="loading" title="Loading billing handoff" /> : null}{handoffs.isError ? <StatePanel state="error" title="Billing handoff unavailable" action={<Button onClick={() => void handoffs.refetch()}>Retry</Button>} /> : null}{existing ? <Link className="v2-button secondary" to={`/${role.toLowerCase()}/billing/handoffs/${existing.id}`}>Open handoff</Link> : null}{allowed && !existing ? <Button variant="secondary" onClick={() => { mutations.createHandoff.reset(); setOpen(true); }}>Create billing handoff</Button> : null}{open ? <CreateHandoffDialog pending={mutations.createHandoff.isPending} error={mutations.createHandoff.error} onCancel={() => setOpen(false)} onSubmit={(payload) => { void mutations.createHandoff.mutateAsync({ visitId: visit.id, payload }).then(() => setOpen(false)); }} /> : null}</SurfaceCard>; }
