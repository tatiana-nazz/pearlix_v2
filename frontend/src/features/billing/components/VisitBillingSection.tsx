import { useState } from "react";

import { useAuthStore } from "../../../auth/authStore";
import { Card } from "../../../components/Card";
import { ErrorState } from "../../../components/ErrorState";
import { LoadingState } from "../../../components/LoadingState";
import { SectionHeader } from "../../../components/SectionHeader";
import { StatusPill } from "../../../components/StatusPill";
import type { UserRole } from "../../../types/auth";
import type { Currency } from "../../../types/clinic";
import type { VisitDetail } from "../../../types/visits";
import { visitCopy } from "../../visits/i18n";
import { useBillingMutations, useHandoffs } from "../hooks/useBilling";
import { displayBillingDateTime, displayBillingText, formatMoney } from "../utils/billing";

function validAmount(value: string) {
  return /^\d+(\.\d{1,2})?$/.test(value) && Number(value) > 0;
}

export function VisitBillingSection({ role, visit }: { role: UserRole; visit: VisitDetail }) {
  const user = useAuthStore((state) => state.user);
  const c = visitCopy(user?.language_preference);
  const handoffs = useHandoffs({ visit_id: visit.id });
  const mutations = useBillingMutations();
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>("SYP");
  const [validation, setValidation] = useState("");
  const ownCompleted = role === "DOCTOR" && user?.id === visit.doctor.id && visit.status === "COMPLETED";
  const existing = handoffs.data?.results[0];
  const invoice = existing?.converted_invoice;

  return <Card className="active-visit-billing-card">
    <SectionHeader title={c.billingWorkspaceTitle} description={c.billingWorkspaceDescription} />
    {handoffs.isLoading ? <LoadingState title={c.billingWorkspaceTitle} /> : null}
    {handoffs.error ? <ErrorState error={handoffs.error} title={c.billingLoadError} onRetry={() => void handoffs.refetch()} /> : null}

    {!handoffs.isLoading && !handoffs.error && existing ? <div className="active-visit-billing-summary">
      <dl className="active-visit-billing-details">
        <div><dt>{c.handoffStatus}</dt><dd><StatusPill status={existing.status} /></dd></div>
        <div><dt>{c.treatmentDescription}</dt><dd>{displayBillingText(existing.visit.appointment.reason)}</dd></div>
        <div><dt>{c.totalTreatmentCharge}</dt><dd dir="ltr">{existing.suggested_amount && existing.currency ? formatMoney(existing.suggested_amount, existing.currency) : c.notRecorded}</dd></div>
        <div><dt>{c.currency}</dt><dd dir="ltr">{existing.currency ?? c.notRecorded}</dd></div>
        <div className="detail-wide"><dt>{c.billingNote}</dt><dd>{displayBillingText(existing.note)}</dd></div>
        <div><dt>{c.created}</dt><dd dir="ltr">{displayBillingDateTime(existing.created_at)}</dd></div>
        <div><dt>{c.updated}</dt><dd dir="ltr">{displayBillingDateTime(existing.updated_at)}</dd></div>
      </dl>
      {invoice ? <div className="active-visit-invoice-summary">
        <h4>{c.invoiceSummary}</h4>
        <dl className="active-visit-billing-details">
          <div><dt>{c.invoiceStatus}</dt><dd><StatusPill status={invoice.status} /></dd></div>
          <div><dt>{c.invoiceReference}</dt><dd dir="ltr">{invoice.invoice_number}</dd></div>
          <div><dt>{c.total}</dt><dd dir="ltr">{formatMoney(invoice.total_amount, invoice.currency)}</dd></div>
          <div><dt>{c.paid}</dt><dd dir="ltr">{formatMoney(invoice.paid_amount, invoice.currency)}</dd></div>
          <div><dt>{c.balance}</dt><dd dir="ltr">{formatMoney(invoice.remaining_amount, invoice.currency)}</dd></div>
          <div><dt>{c.currency}</dt><dd dir="ltr">{invoice.currency}</dd></div>
        </dl>
      </div> : null}
    </div> : null}

    {!handoffs.isLoading && !handoffs.error && !existing && !ownCompleted ? <div className="active-visit-billing-state"><p>{c.billingCompleteFirst}</p></div> : null}

    {!handoffs.isLoading && !handoffs.error && !existing ? <form className="active-visit-billing-form" aria-disabled={!ownCompleted || undefined} onSubmit={(event) => {
      event.preventDefault();
      if (!ownCompleted) return;
      if (!validAmount(amount)) { setValidation(c.invalidTreatmentCharge); return; }
      setValidation("");
      mutations.createHandoff.reset();
      void mutations.createHandoff.mutateAsync({ visitId: visit.id, payload: { note, suggested_amount: amount, currency } });
    }}>
      <div className="form-field active-visit-billing-description"><label htmlFor="billing-description">{c.treatmentDescription}</label><textarea id="billing-description" rows={3} value={visit.treatment} readOnly /><small>{c.treatmentDescriptionHelper}</small></div>
      <div className="form-field"><label htmlFor="billing-amount">{c.totalTreatmentCharge}</label><input id="billing-amount" required inputMode="decimal" value={amount} disabled={!ownCompleted} aria-invalid={Boolean(validation)} aria-describedby={validation ? "billing-amount-error" : undefined} onChange={(event) => { setAmount(event.target.value); setValidation(""); }} /></div>
      <div className="form-field"><label htmlFor="billing-currency">{c.currency}</label><select id="billing-currency" value={currency} disabled={!ownCompleted} onChange={(event) => setCurrency(event.target.value as Currency)}><option value="SYP">SYP</option><option value="USD">USD</option></select></div>
      <div className="form-field active-visit-billing-note"><label htmlFor="billing-note">{c.billingNote}</label><textarea id="billing-note" rows={3} value={note} disabled={!ownCompleted} onChange={(event) => setNote(event.target.value)} /><small>{c.billingNoteHelper}</small></div>
      {validation ? <p id="billing-amount-error" className="field-error" role="alert">{validation}</p> : null}
      {mutations.createHandoff.error ? <ErrorState error={mutations.createHandoff.error} title={c.billingSendError} /> : null}
      <div className="form-actions"><button className="button primary" type="submit" disabled={!ownCompleted || mutations.createHandoff.isPending} aria-busy={mutations.createHandoff.isPending || undefined}>{mutations.createHandoff.isPending ? c.sendingToBilling : c.sendToBilling}</button></div>
    </form> : null}
  </Card>;
}
