import { ErrorState } from "../../../components/ErrorState";
import type { AppointmentListItem } from "../../../types/appointments";
import { Modal } from "../../../components/v2";
import { useAuthStore } from "../../../auth/authStore";
import { appointmentCopy } from "../i18n";

interface AppointmentConfirmDialogProps {
  appointment: AppointmentListItem | null;
  action: "check-in" | "cancel" | "no-show" | null;
  isSubmitting?: boolean;
  error?: unknown;
  onCancel: () => void;
  onConfirm: () => void;
}

export function AppointmentConfirmDialog({ appointment, action, isSubmitting, error, onCancel, onConfirm }: AppointmentConfirmDialogProps) {
  const language = useAuthStore((state) => state.user?.language_preference ?? "EN");
  const c = appointmentCopy(language);
  if (!appointment || !action) return null;
  const labels = { "check-in": c.actionCheckIn, cancel: c.actionCancel, "no-show": c.actionNoShow };
  return (
      <Modal open title={c.confirmAction} onClose={onCancel}>
        <div>
          <p className="eyebrow">{c.action}</p>
          <h3>{c.confirmAction}</h3>
        </div>
        <p>
          This will {labels[action]} for {appointment.patient.full_name}.
        </p>
        {error ? <ErrorState error={error} title={c.actionUnavailable} /> : null}
        <div className="form-actions">
          <button className="button secondary" type="button" onClick={onCancel}>
            {c.keepAppointment}
          </button>
          <button className="button primary" type="button" disabled={isSubmitting} onClick={onConfirm}>
            {c.confirm}
          </button>
        </div>
      </Modal>
  );
}
