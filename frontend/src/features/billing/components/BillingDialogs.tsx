import { useState } from "react";

import { Button, ConfirmDialog, Modal } from "../../../components/v2";
import { useFeatureT } from "../../../layouts/i18n";
import type { BillingHandoffCreatePayload, HandoffConversionPayload, Invoice, InvoicePayload, PaymentPayload } from "../../../types/billing";
import { isPositiveMoney } from "../utils/billing";

const currencies = <><option value="USD">USD</option><option value="SYP">SYP</option></>;

function Error({ error, message }: { error?: unknown; message: string }) {
  return error ? <p className="form-error" role="alert">{message}</p> : null;
}

export function CreateHandoffDialog({ error, pending, onCancel, onSubmit }: { error?: unknown; pending: boolean; onCancel: () => void; onSubmit: (payload: BillingHandoffCreatePayload) => void }) {
  const t = useFeatureT();
  const [note, setNote] = useState(""); const [amount, setAmount] = useState(""); const [currency, setCurrency] = useState("USD"); const [validation, setValidation] = useState("");
  const dirty = Boolean(note || amount);
  return <Modal open wide title={t("createHandoff")} description={t("createHandoffDescription")} pending={pending} dirty={dirty} onClose={onCancel}><form className="clinical-notes-form" onSubmit={(event) => { event.preventDefault(); if (amount && !isPositiveMoney(amount)) { setValidation(t("suggestedAmountInvalid")); return; } setValidation(""); onSubmit({ ...(note.trim() ? { note: note.trim() } : {}), ...(amount ? { suggested_amount: amount, currency: currency as "USD" | "SYP" } : {}) }); }}><label>{t("note")}<textarea rows={3} disabled={pending} value={note} onChange={(event) => setNote(event.target.value)} /></label><label>{t("suggestedAmount")}<input inputMode="decimal" disabled={pending} value={amount} onChange={(event) => setAmount(event.target.value)} /></label><label>{t("currency")}<select value={currency} disabled={pending || !amount} onChange={(event) => setCurrency(event.target.value)}>{currencies}</select></label>{validation ? <p className="field-error" role="alert">{validation}</p> : null}<Error error={error} message={t("handoffCreateFailed")} /><div className="form-actions"><Button variant="secondary" type="button" disabled={pending} onClick={onCancel}>{t("cancel")}</Button><Button type="submit" loading={pending}>{t("create")}</Button></div></form></Modal>;
}

export function ConvertHandoffDialog({ suggestedAmount, suggestedCurrency, error, pending, onCancel, onSubmit }: { suggestedAmount: string | null; suggestedCurrency: "USD" | "SYP" | null; error?: unknown; pending: boolean; onCancel: () => void; onSubmit: (payload: HandoffConversionPayload) => void }) {
  const t = useFeatureT();
  const [amount, setAmount] = useState(suggestedAmount ?? ""); const [currency, setCurrency] = useState<"USD" | "SYP">(suggestedCurrency ?? "USD"); const [notes, setNotes] = useState(""); const [validation, setValidation] = useState("");
  const dirty = Boolean(amount || notes);
  return <Modal open title={t("convertHandoffTitle")} description={t("convertHandoffDescription")} pending={pending} dirty={dirty} onClose={onCancel}><form className="clinical-notes-form" onSubmit={(event) => { event.preventDefault(); if (!isPositiveMoney(amount)) { setValidation(t("totalAmountRequired")); return; } setValidation(""); onSubmit({ total_amount: amount, currency, ...(notes.trim() ? { notes: notes.trim() } : {}) }); }}><label>{t("totalAmount")}<input inputMode="decimal" disabled={pending} value={amount} onChange={(event) => setAmount(event.target.value)} /></label><label>{t("currency")}<select disabled={pending} value={currency} onChange={(event) => setCurrency(event.target.value as "USD" | "SYP")}>{currencies}</select></label><label>{t("notes")}<textarea rows={3} disabled={pending} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>{validation ? <p className="field-error" role="alert">{validation}</p> : null}<Error error={error} message={t("handoffConvertFailed")} /><div className="form-actions"><Button variant="secondary" type="button" disabled={pending} onClick={onCancel}>{t("cancel")}</Button><Button type="submit" loading={pending}>{t("convertInvoice")}</Button></div></form></Modal>;
}

export function PaymentDialog({ currency, remaining, error, pending, onCancel, onSubmit }: { currency: "USD" | "SYP"; remaining: string; error?: unknown; pending: boolean; onCancel: () => void; onSubmit: (payload: PaymentPayload) => void }) {
  const t = useFeatureT();
  const [amount, setAmount] = useState(""); const [notes, setNotes] = useState(""); const [validation, setValidation] = useState("");
  const dirty = Boolean(amount || notes);
  return <Modal open title={t("recordPayment")} description={`${t("remainingBalance")}: ${remaining} ${currency}.`} pending={pending} dirty={dirty} onClose={onCancel}><form className="clinical-notes-form" onSubmit={(event) => { event.preventDefault(); if (!isPositiveMoney(amount)) { setValidation(t("paymentAmountInvalid")); return; } if (Number(amount) > Number(remaining)) { setValidation(t("paymentExceedsBalance")); return; } setValidation(""); onSubmit({ amount, currency, ...(notes.trim() ? { notes: notes.trim() } : {}) }); }}><label>{t("amount")}<input inputMode="decimal" disabled={pending} value={amount} onChange={(event) => setAmount(event.target.value)} /></label><label>{t("currency")}<input value={currency} readOnly /></label><label>{t("notes")}<textarea rows={3} disabled={pending} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>{validation ? <p className="field-error" role="alert">{validation}</p> : null}<Error error={error} message={t("paymentFailed")} /><div className="form-actions"><Button variant="secondary" type="button" disabled={pending} onClick={onCancel}>{t("cancel")}</Button><Button type="submit" loading={pending}>{t("recordPayment")}</Button></div></form></Modal>;
}

export function InvoiceEditDialog({ invoice, error, pending, onCancel, onSubmit }: { invoice: Invoice; error?: unknown; pending: boolean; onCancel: () => void; onSubmit: (payload: InvoicePayload) => void }) {
  const t = useFeatureT();
  const [amount, setAmount] = useState(invoice.total_amount); const [currency, setCurrency] = useState(invoice.currency); const [notes, setNotes] = useState(invoice.notes);
  const [validation, setValidation] = useState("");
  const paymentsLockAmounts = invoice.payment_count > 0;
  const notesLocked = Boolean(invoice.billing_handoff && invoice.payment_count > 0);
  const dirty = amount !== invoice.total_amount || currency !== invoice.currency || notes !== invoice.notes;
  return <Modal open title={t("editInvoice")} description={t("editInvoiceDescription")} pending={pending} dirty={dirty} onClose={onCancel}><form className="clinical-notes-form" onSubmit={(event) => { event.preventDefault(); if (!paymentsLockAmounts && !isPositiveMoney(amount)) { setValidation(t("totalAmountRequired")); return; } const payload: InvoicePayload = {}; if (!paymentsLockAmounts && amount !== invoice.total_amount) payload.total_amount = amount; if (!paymentsLockAmounts && currency !== invoice.currency) payload.currency = currency; if (!notesLocked && notes !== invoice.notes) payload.notes = notes.trim(); setValidation(""); if (Object.keys(payload).length) onSubmit(payload); else onCancel(); }}><label>{t("totalAmount")}<input inputMode="decimal" disabled={pending || paymentsLockAmounts} value={amount} onChange={(event) => setAmount(event.target.value)} /></label><label>{t("currency")}<select disabled={pending || paymentsLockAmounts} value={currency} onChange={(event) => setCurrency(event.target.value as "USD" | "SYP")}>{currencies}</select></label><label>{t("notes")}<textarea rows={3} disabled={pending || notesLocked} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>{validation ? <p className="field-error" role="alert">{validation}</p> : null}<Error error={error} message={t("invoiceUpdateFailed")} /><div className="form-actions"><Button variant="secondary" type="button" disabled={pending} onClick={onCancel}>{t("cancel")}</Button><Button type="submit" loading={pending} disabled={!dirty}>{t("save")}</Button></div></form></Modal>;
}

export function ReasonDialog({ title, description, submitLabel, pending, error, onCancel, onSubmit }: { title: string; description: string; submitLabel: string; pending: boolean; error?: unknown; onCancel: () => void; onSubmit: (reason?: string) => void }) {
  const t = useFeatureT();
  const [reason, setReason] = useState("");
  return <ConfirmDialog open title={title} description={description} pending={pending} dirty={Boolean(reason)} onClose={onCancel}><label>{t("reasonOptional")}<textarea rows={3} disabled={pending} value={reason} onChange={(event) => setReason(event.target.value)} /></label><Error error={error} message={t("actionFailed")} /><div className="form-actions"><Button variant="secondary" type="button" disabled={pending} onClick={onCancel}>{t("keepRecord")}</Button><Button variant="danger" type="button" loading={pending} onClick={() => onSubmit(reason.trim() || undefined)}>{submitLabel}</Button></div></ConfirmDialog>;
}
