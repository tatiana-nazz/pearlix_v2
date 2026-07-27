import { useEffect } from "react";

import { clinicApi } from "../../../api/endpoints/clinic";
import { useAuthStore } from "../../../auth/authStore";
import { Card } from "../../../components/Card";
import { ErrorState } from "../../../components/ErrorState";
import { LoadingState } from "../../../components/LoadingState";
import { SectionHeader } from "../../../components/SectionHeader";
import { StatusPill } from "../../../components/StatusPill";
import type { UserRole } from "../../../types/auth";
import type { BillingHandoff } from "../../../types/billing";
import type { Currency } from "../../../types/clinic";
import type { VisitDetail } from "../../../types/visits";
import { visitCopy } from "../../visits/i18n";
import { useHandoffs } from "../hooks/useBilling";
import { displayBillingDateTime, displayBillingText, formatMoney } from "../utils/billing";

export interface VisitBillingDraft {
  description: string;
  amount: string;
  currency: Currency | "";
  note: string;
}

export type VisitBillingErrors = Partial<Record<"description" | "amount" | "currency", string>>;

export function VisitBillingSection({
  role,
  visit,
  draft,
  errors,
  onDraftChange,
}: {
  role: UserRole;
  visit: VisitDetail;
  draft: VisitBillingDraft;
  errors: VisitBillingErrors;
  onDraftChange: <Key extends keyof VisitBillingDraft>(key: Key, value: VisitBillingDraft[Key]) => void;
}) {
  const user = useAuthStore((state) => state.user);
  const c = visitCopy(user?.language_preference);
  const handoffs = useHandoffs({ visit_id: visit.id });
  const existing = handoffs.data?.results[0];
  const invoice = existing?.converted_invoice;
  const canEditDraft = role === "DOCTOR" && user?.id === visit.doctor.id && visit.status === "ACTIVE" && !existing;

  useEffect(() => {
    if (!canEditDraft || draft.currency) return;
    let active = true;
    void clinicApi.getSettings().then((settings) => {
      if (active && !draft.currency) onDraftChange("currency", settings.default_currency);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [canEditDraft, draft.currency, onDraftChange]);

  return <Card className="active-visit-billing-card">
    <SectionHeader title={c.billingWorkspaceTitle} description={existing ? c.billingWorkspaceDescription : c.billingCompletionDescription} />
    {handoffs.isLoading ? <LoadingState title={c.billingWorkspaceTitle} /> : null}
    {handoffs.error ? <ErrorState error={handoffs.error} title={c.billingLoadError} onRetry={() => void handoffs.refetch()} /> : null}

    {!handoffs.isLoading && !handoffs.error && existing ? <div className="active-visit-billing-summary">
      <dl className="active-visit-billing-details">
        <div><dt>{c.handoffStatus}</dt><dd><StatusPill status={existing.status} /></dd></div>
        <div><dt>{c.treatmentDescription}</dt><dd>{displayBillingText((existing as BillingHandoff & { description?: string }).description)}</dd></div>
        <div><dt>{c.totalTreatmentCharge}</dt><dd dir="ltr">{existing.suggested_amount && existing.currency ? formatMoney(existing.suggested_amount, existing.currency) : c.notRecorded}</dd></div>
        <div><dt>{c.currency}</dt><dd dir="ltr">{existing.currency ?? c.notRecorded}</dd></div>
        <div className="detail-wide"><dt>{c.billingNote}</dt><dd>{displayBillingText(existing.note)}</dd></div>
        <div><dt>{c.created}</dt><dd dir="ltr">{displayBillingDateTime(existing.created_at)}</dd></div>
        <div><dt>{c.updated}</dt><dd dir="ltr">{displayBillingDateTime(existing.updated_at)}</dd></div>
      </dl>
      {invoice ? <div className="active-visit-invoice-summary"><h4>{c.invoiceSummary}</h4><dl className="active-visit-billing-details">
        <div><dt>{c.invoiceStatus}</dt><dd><StatusPill status={invoice.status} /></dd></div>
        <div><dt>{c.invoiceReference}</dt><dd dir="ltr">{invoice.invoice_number}</dd></div>
        <div><dt>{c.total}</dt><dd dir="ltr">{formatMoney(invoice.total_amount, invoice.currency)}</dd></div>
        <div><dt>{c.paid}</dt><dd dir="ltr">{formatMoney(invoice.paid_amount, invoice.currency)}</dd></div>
        <div><dt>{c.balance}</dt><dd dir="ltr">{formatMoney(invoice.remaining_amount, invoice.currency)}</dd></div>
        <div><dt>{c.currency}</dt><dd dir="ltr">{invoice.currency}</dd></div>
      </dl></div> : null}
    </div> : null}

    {!handoffs.isLoading && !handoffs.error && !existing ? <form className="active-visit-billing-form" onSubmit={(event) => event.preventDefault()}>
      <div className="form-field active-visit-billing-description"><label htmlFor="billing-description">{c.treatmentDescription}</label><textarea id="billing-description" rows={3} required value={draft.description} readOnly={!canEditDraft} aria-invalid={Boolean(errors.description)} aria-describedby={errors.description ? "billing-description-error" : "billing-description-help"} onChange={(event) => onDraftChange("description", event.target.value)} /><small id="billing-description-help">{c.treatmentDescriptionHelper}</small>{errors.description ? <span id="billing-description-error" className="field-error" role="alert">{errors.description}</span> : null}</div>
      <div className="form-field"><label htmlFor="billing-amount">{c.totalTreatmentCharge}</label><input id="billing-amount" required inputMode="decimal" value={draft.amount} readOnly={!canEditDraft} aria-invalid={Boolean(errors.amount)} aria-describedby={errors.amount ? "billing-amount-error" : undefined} onChange={(event) => onDraftChange("amount", event.target.value)} />{errors.amount ? <span id="billing-amount-error" className="field-error" role="alert">{errors.amount}</span> : null}</div>
      <div className="form-field"><label htmlFor="billing-currency">{c.currency}</label><select id="billing-currency" required value={draft.currency} disabled={!canEditDraft} aria-invalid={Boolean(errors.currency)} aria-describedby={errors.currency ? "billing-currency-error" : undefined} onChange={(event) => onDraftChange("currency", event.target.value as Currency)}><option value="" disabled>{c.selectCurrency}</option><option value="SYP">SYP</option><option value="USD">USD</option></select>{errors.currency ? <span id="billing-currency-error" className="field-error" role="alert">{errors.currency}</span> : null}</div>
      <div className="form-field active-visit-billing-note"><label htmlFor="billing-note">{c.billingNote}</label><textarea id="billing-note" rows={3} value={draft.note} readOnly={!canEditDraft} onChange={(event) => onDraftChange("note", event.target.value)} /><small>{c.billingNoteHelper}</small></div>
    </form> : null}
  </Card>;
}
