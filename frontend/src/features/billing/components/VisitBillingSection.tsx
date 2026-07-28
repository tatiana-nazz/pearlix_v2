import { useEffect } from "react";

import { clinicApi } from "../../../api/endpoints/clinic";
import { useAuthStore } from "../../../auth/authStore";
import { Card } from "../../../components/Card";
import { ErrorState } from "../../../components/ErrorState";
import { LoadingState } from "../../../components/LoadingState";
import { SectionHeader } from "../../../components/SectionHeader";
import { StatusBadge } from "../../../components/v2";
import { useFeatureT } from "../../../layouts/i18n";
import type { UserRole } from "../../../types/auth";
import type { Currency } from "../../../types/clinic";
import type { VisitDetail } from "../../../types/visits";
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
  const t = useFeatureT();
  const user = useAuthStore((state) => state.user);
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
    <SectionHeader title={t("billingWorkspaceTitle")} description={t("billingCompletionDescription")} />
    {handoffs.isLoading ? <LoadingState title={t("billingWorkspaceTitle")} /> : null}
    {handoffs.error ? <ErrorState error={handoffs.error} title={t("billingLoadError")} onRetry={() => void handoffs.refetch()} /> : null}

    {!handoffs.isLoading && !handoffs.error && existing ? <div className="active-visit-billing-summary">
      <dl className="active-visit-billing-details">
        <div><dt>{t("handoffStatus")}</dt><dd><StatusBadge status={existing.status} /></dd></div>
        <div><dt>{t("treatmentDescription")}</dt><dd>{displayBillingText(existing.description)}</dd></div>
        <div><dt>{t("totalTreatmentCharge")}</dt><dd dir="ltr">{existing.suggested_amount && existing.currency ? formatMoney(existing.suggested_amount, existing.currency) : t("notRecorded")}</dd></div>
        <div><dt>{t("currency")}</dt><dd dir="ltr">{existing.currency ?? t("notRecorded")}</dd></div>
        <div className="detail-wide"><dt>{t("billingNote")}</dt><dd>{displayBillingText(existing.note)}</dd></div>
        <div><dt>{t("created")}</dt><dd dir="ltr">{displayBillingDateTime(existing.created_at)}</dd></div>
        <div><dt>{t("updated")}</dt><dd dir="ltr">{displayBillingDateTime(existing.updated_at)}</dd></div>
      </dl>
      {invoice ? <div className="active-visit-invoice-summary"><h4>{t("invoiceSummary")}</h4><dl className="active-visit-billing-details">
        <div><dt>{t("invoiceStatus")}</dt><dd><StatusBadge status={invoice.status} /></dd></div>
        <div><dt>{t("invoiceReference")}</dt><dd dir="ltr">{invoice.invoice_number}</dd></div>
        <div><dt>{t("total")}</dt><dd dir="ltr">{formatMoney(invoice.total_amount, invoice.currency)}</dd></div>
        <div><dt>{t("paid")}</dt><dd dir="ltr">{formatMoney(invoice.paid_amount, invoice.currency)}</dd></div>
        <div><dt>{t("balance")}</dt><dd dir="ltr">{formatMoney(invoice.remaining_amount, invoice.currency)}</dd></div>
      </dl></div> : null}
    </div> : null}

    {!handoffs.isLoading && !handoffs.error && !existing ? <form className="active-visit-billing-form" onSubmit={(event) => event.preventDefault()}>
      <div className="form-field active-visit-billing-description"><label htmlFor="billing-description">{t("treatmentDescription")}</label><textarea id="billing-description" rows={3} required value={draft.description} readOnly={!canEditDraft} aria-invalid={Boolean(errors.description)} aria-describedby={errors.description ? "billing-description-error" : "billing-description-help"} onChange={(event) => onDraftChange("description", event.target.value)} /><small id="billing-description-help">{t("treatmentDescriptionHelper")}</small>{errors.description ? <span id="billing-description-error" className="field-error" role="alert">{errors.description}</span> : null}</div>
      <div className="form-field"><label htmlFor="billing-amount">{t("totalTreatmentCharge")}</label><input id="billing-amount" required inputMode="decimal" value={draft.amount} readOnly={!canEditDraft} aria-invalid={Boolean(errors.amount)} aria-describedby={errors.amount ? "billing-amount-error" : undefined} onChange={(event) => onDraftChange("amount", event.target.value)} />{errors.amount ? <span id="billing-amount-error" className="field-error" role="alert">{errors.amount}</span> : null}</div>
      <div className="form-field"><label htmlFor="billing-currency">{t("currency")}</label><select id="billing-currency" required value={draft.currency} disabled={!canEditDraft} aria-invalid={Boolean(errors.currency)} aria-describedby={errors.currency ? "billing-currency-error" : undefined} onChange={(event) => onDraftChange("currency", event.target.value as Currency)}><option value="" disabled>{t("selectCurrency")}</option><option value="SYP">SYP</option><option value="USD">USD</option></select>{errors.currency ? <span id="billing-currency-error" className="field-error" role="alert">{errors.currency}</span> : null}</div>
      <div className="form-field active-visit-billing-note"><label htmlFor="billing-note">{t("billingNote")}</label><textarea id="billing-note" rows={3} value={draft.note} readOnly={!canEditDraft} onChange={(event) => onDraftChange("note", event.target.value)} /><small>{t("billingNoteHelper")}</small></div>
    </form> : null}
  </Card>;
}
