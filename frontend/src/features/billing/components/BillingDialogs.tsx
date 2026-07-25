import { useState } from "react";

import { ErrorState } from "../../../components/ErrorState";
import { Modal } from "../../../components/v2";
import { useAuthStore } from "../../../auth/authStore";
import type { BillingHandoffCreatePayload, HandoffConversionPayload, PaymentPayload } from "../../../types/billing";

function paymentCopy(language: "EN" | "AR") {
  return language === "AR"
    ? { title: "تسجيل دفعة", amount: "المبلغ", currency: "العملة", notes: "ملاحظات", cancel: "إلغاء", submit: "تسجيل الدفعة", invalid: "أدخل مبلغاً موجباً صالحاً.", unavailable: "لم يتم تسجيل الدفعة" }
    : { title: "Record payment", amount: "Amount", currency: "Currency", notes: "Notes", cancel: "Cancel", submit: "Record payment", invalid: "Enter a valid positive amount.", unavailable: "Payment was not recorded" };
}

function validAmount(amount: string) {
  return /^\d+(\.\d{1,2})?$/.test(amount) && Number(amount) > 0;
}

export function CreateHandoffDialog({ error, pending, onCancel, onSubmit }: { error?: unknown; pending: boolean; onCancel: () => void; onSubmit: (payload: BillingHandoffCreatePayload) => void }) {
  const [note, setNote] = useState(""); const [amount, setAmount] = useState(""); const [currency, setCurrency] = useState("USD"); const [validation, setValidation] = useState("");
  return <Modal open title="Create billing handoff" onClose={onCancel} pending={pending}><form className="clinical-notes-form" onSubmit={(event) => { event.preventDefault(); if (amount && !validAmount(amount)) return setValidation("Suggested amount must be positive."); setValidation(""); onSubmit({ note, suggested_amount: amount || null, currency: amount ? currency as "USD" | "SYP" : null }); }}><label>Note<textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></label><label>Suggested amount<input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></label><label>Currency<select value={currency} disabled={!amount} onChange={(e) => setCurrency(e.target.value)}><option value="USD">USD</option><option value="SYP">SYP</option></select></label>{validation ? <p className="field-error" role="alert">{validation}</p> : null}{error ? <ErrorState error={error} title="Unable to create handoff" /> : null}<div className="form-actions"><button className="button secondary" type="button" disabled={pending} onClick={onCancel}>Cancel</button><button className="button primary" disabled={pending}>Create handoff</button></div></form></Modal>;
}

export function ConvertHandoffDialog({ error, pending, onCancel, onSubmit }: { error?: unknown; pending: boolean; onCancel: () => void; onSubmit: (payload: HandoffConversionPayload) => void }) {
  const [amount, setAmount] = useState(""); const [currency, setCurrency] = useState("USD"); const [notes, setNotes] = useState(""); const [validation, setValidation] = useState("");
  return <Modal open title="Convert handoff to invoice" onClose={onCancel} pending={pending}><form className="clinical-notes-form" onSubmit={(e) => { e.preventDefault(); if (amount && !validAmount(amount)) return setValidation("Enter a valid positive total amount."); setValidation(""); onSubmit({ total_amount: amount || undefined, currency: amount ? currency as "USD" | "SYP" : undefined, notes }); }}><p className="form-note">Leave the amount blank only when the backend can use the handoff suggestion.</p><label>Total amount<input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></label><label>Currency<select value={currency} onChange={(e) => setCurrency(e.target.value)}><option value="USD">USD</option><option value="SYP">SYP</option></select></label><label>Notes<textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>{validation ? <p className="field-error" role="alert">{validation}</p> : null}{error ? <ErrorState error={error} title="Unable to convert handoff" /> : null}<div className="form-actions"><button className="button secondary" type="button" disabled={pending} onClick={onCancel}>Cancel</button><button className="button primary" disabled={pending}>Convert to invoice</button></div></form></Modal>;
}

export function PaymentDialog({ currency, error, pending, remainingAmount, onCancel, onSubmit }: { currency: "USD" | "SYP"; error?: unknown; pending: boolean; remainingAmount: string; onCancel: () => void; onSubmit: (payload: PaymentPayload) => void }) {
  const [amount, setAmount] = useState(""); const [notes, setNotes] = useState(""); const [validation, setValidation] = useState("");
  const c = paymentCopy(useAuthStore((state) => state.user?.language_preference ?? "EN"));
  return <Modal open title={c.title} onClose={onCancel} pending={pending}><form className="clinical-notes-form" onSubmit={(e) => { e.preventDefault(); if (!validAmount(amount)) return setValidation(c.invalid); setValidation(""); onSubmit({ amount, currency, notes }); }}><p className="form-note" dir="ltr">Remaining balance: {remainingAmount} {currency}</p><label>{c.amount}<input required inputMode="decimal" aria-invalid={Boolean(validation)} aria-describedby={validation ? "payment-amount-error" : undefined} value={amount} onChange={(e) => { setAmount(e.target.value); setValidation(""); }} /></label><label>{c.currency}<input value={currency} readOnly dir="ltr" /></label><label>{c.notes}<textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>{validation ? <p id="payment-amount-error" className="field-error" role="alert">{validation}</p> : null}{error ? <ErrorState error={error} title={c.unavailable} /> : null}<div className="form-actions"><button className="button secondary" type="button" disabled={pending} onClick={onCancel}>{c.cancel}</button><button className="button primary" disabled={pending}>{pending ? "…" : c.submit}</button></div></form></Modal>;
}
