import { useState } from "react";

import { ErrorState } from "../../../components/ErrorState";
import { Modal } from "../../../components/v2";
import type { BillingHandoff, InvoiceIssuePayload } from "../../../types/billing";
import { formatMoney } from "../utils/billing";

function validAmount(value: string) {
  return /^\d+(?:\.\d{1,2})?$/.test(value) && Number(value) > 0;
}

export function RecordPaymentDialog({
  handoff,
  error,
  pending,
  onCancel,
  onSubmit,
}: {
  handoff: BillingHandoff;
  error?: unknown;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (payload: InvoiceIssuePayload) => void;
}) {
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [notes, setNotes] = useState("");
  const [validation, setValidation] = useState("");

  return <Modal open title="Record payment & issue invoice" description="The invoice is the immutable receipt for this payment." onClose={onCancel} pending={pending}>
    <form className="clinical-notes-form payment-form" onSubmit={(event) => {
      event.preventDefault();
      if (!validAmount(amount) || Number(amount) > Number(handoff.remaining_amount)) {
        setValidation("Enter a positive amount no greater than the remaining balance.");
        return;
      }
      setValidation("");
      onSubmit({ amount, issued_at: paymentDate ? new Date(paymentDate).toISOString() : undefined, notes });
    }}>
      <dl className="payment-context payment-context-grid">
        <div><dt>Patient</dt><dd>{handoff.patient.full_name}</dd></div>
        <div><dt>Treatment</dt><dd>{handoff.description}</dd></div>
        <div><dt>Bill total</dt><dd dir="ltr">{formatMoney(handoff.total_amount, handoff.currency)}</dd></div>
        <div><dt>Paid</dt><dd dir="ltr">{formatMoney(handoff.paid_amount, handoff.currency)}</dd></div>
        <div><dt>Remaining</dt><dd dir="ltr">{formatMoney(handoff.remaining_amount, handoff.currency)}</dd></div>
        <div><dt>Currency</dt><dd dir="ltr">{handoff.currency}</dd></div>
      </dl>
      <button className="button secondary pay-remaining-button" type="button" disabled={pending} onClick={() => { setAmount(handoff.remaining_amount); setValidation(""); }}>Pay remaining balance</button>
      <label>Payment amount<input required inputMode="decimal" aria-invalid={Boolean(validation)} value={amount} onChange={(event) => { setAmount(event.target.value); setValidation(""); }} /></label>
      <label>Payment date <span>(optional)</span><input type="datetime-local" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} /></label>
      <label>Notes <span>(optional)</span><textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
      {validation ? <p className="field-error" role="alert">{validation}</p> : null}
      {error ? <ErrorState error={error} title="Payment was not recorded" /> : null}
      <div className="form-actions"><button className="button secondary" type="button" disabled={pending} onClick={onCancel}>Cancel</button><button className="button primary" disabled={pending}>{pending ? "Issuing…" : "Record payment & issue invoice"}</button></div>
    </form>
  </Modal>;
}
