import { ErrorState } from "../../../components/ErrorState";
import type { AppointmentListItem } from "../../../types/appointments";

interface AppointmentConfirmDialogProps {
  appointment: AppointmentListItem | null;
  action: "check-in" | "cancel" | "no-show" | "start-visit" | null;
  isSubmitting?: boolean;
  error?: unknown;
  onCancel: () => void;
  onConfirm: () => void;
}

const labels = {
  "check-in": "check in this appointment",
  cancel: "cancel this appointment",
  "no-show": "mark this appointment as no-show",
  "start-visit": "start this visit",
};

export function AppointmentConfirmDialog({ appointment, action, isSubmitting, error, onCancel, onConfirm }: AppointmentConfirmDialogProps) {
  if (!appointment || !action) return null;
  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="dialog-panel" role="dialog" aria-modal="true" aria-labelledby="appointment-action-title">
        <div>
          <p className="eyebrow">Appointment action</p>
          <h3 id="appointment-action-title">Confirm action</h3>
        </div>
        <p>
          This will {labels[action]} for {appointment.patient.full_name}.
        </p>
        {error ? <ErrorState error={error} title="Unable to complete action" /> : null}
        <div className="form-actions">
          <button className="button secondary" type="button" onClick={onCancel}>
            Keep appointment
          </button>
          <button className="button primary" type="button" disabled={isSubmitting} onClick={onConfirm}>
            Confirm
          </button>
        </div>
      </section>
    </div>
  );
}
