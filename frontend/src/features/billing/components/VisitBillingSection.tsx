import { useState } from "react";

import { useAuthStore } from "../../../auth/authStore";
import { Button, StatePanel, StatusBadge, SurfaceCard } from "../../../components/v2";
import { useFeatureT } from "../../../layouts/i18n";
import type { UserRole } from "../../../types/auth";
import type { VisitDetail } from "../../../types/visits";
import { useBillingMutations, useVisitInvoice } from "../hooks/useBilling";
import { formatMoney, isPositiveMoney } from "../utils/billing";
import { formatDateTime } from "../../../utils/dates";

export function VisitBillingSection({ role, visit }: { role: UserRole; visit: VisitDetail }) {
  const t = useFeatureT();
  const user = useAuthStore((state) => state.user);
  const invoiceQuery = useVisitInvoice(visit.id);
  const mutations = useBillingMutations();
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<"USD" | "SYP">("USD");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const allowed = role === "DOCTOR" && user?.id === visit.doctor.id && visit.status === "COMPLETED";
  const invoice = invoiceQuery.data;
  if (role !== "DOCTOR" || user?.id !== visit.doctor.id) return null;
  if (invoiceQuery.isLoading) return <SurfaceCard><StatePanel state="loading" title={t("loadingInvoice")} /></SurfaceCard>;
  if (invoiceQuery.isError && allowed) return <SurfaceCard><StatePanel state="error" title={t("invoiceUnavailable")} action={<Button onClick={() => void invoiceQuery.refetch()}>{t("retry")}</Button>} /></SurfaceCard>;
  if (invoice) return <SurfaceCard><h3>{t("invoice")}</h3><div className="invoice-details-status"><StatusBadge status={invoice.status} /></div><dl className="detail-grid"><div><dt>{t("invoice")}</dt><dd>{invoice.invoice_number}</dd></div><div><dt>{t("total")}</dt><dd>{formatMoney(invoice.total_amount, invoice.currency)}</dd></div><div><dt>{t("paid")}</dt><dd>{formatMoney(invoice.paid_amount, invoice.currency)}</dd></div><div><dt>{t("remaining")}</dt><dd>{formatMoney(invoice.remaining_amount, invoice.currency)}</dd></div><div><dt>{t("currency")}</dt><dd>{invoice.currency}</dd></div><div><dt>{t("created")}</dt><dd>{formatDateTime(invoice.created_at)}</dd></div>{invoice.notes ? <div className="detail-wide"><dt>{t("notes")}</dt><dd>{invoice.notes}</dd></div> : null}</dl></SurfaceCard>;
  if (!allowed) return null;
  const submit = (event: React.FormEvent) => { event.preventDefault(); if (!isPositiveMoney(amount)) { setError(t("amountMustBePositive")); return; } setError(""); void mutations.createFinalChargeInvoice.mutateAsync({ visitId: visit.id, payload: { total_amount: amount, currency, ...(notes.trim() ? { notes: notes.trim() } : {}) } }).catch(() => setError(t("finalChargeFailed"))); };
  return <SurfaceCard><h3>{t("finalCharge")}</h3><p>{t("finalChargeGuidance")}</p><form className="clinical-notes-form" onSubmit={submit}><label>{t("finalCharge")}<input required inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} /></label><label>{t("currency")}<select value={currency} onChange={(event) => setCurrency(event.target.value as "USD" | "SYP")}><option value="USD">USD</option><option value="SYP">SYP</option></select></label><label>{t("billingNoteOptional")}<textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>{error || mutations.createFinalChargeInvoice.error ? <p className="form-error" role="alert">{error || t("finalChargeFailed")}</p> : null}<div className="v2-sticky-actions"><Button type="submit" loading={mutations.createFinalChargeInvoice.isPending} disabled={mutations.createFinalChargeInvoice.isPending}>{t("createInvoice")}</Button></div></form></SurfaceCard>;
}
