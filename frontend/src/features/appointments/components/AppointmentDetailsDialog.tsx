import { AppointmentStatusBadge } from "./AppointmentStatusBadge";
import type { AppointmentListItem } from "../../../types/appointments";
import { formatDateRange } from "../../../utils/dates";
import { displayText } from "../../../utils/formatters";

interface AppointmentDetailsDialogProps {
  appointment: AppointmentListItem | null;
  onClose: () => void;
}

export function AppointmentDetailsDialog({ appointment, onClose }: AppointmentDetailsDialogProps) {
  if (!appointment) return null;
  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="dialog-panel" role="dialog" aria-modal="true" aria-labelledby="appointment-details-title">
        <div>
          <p className="eyebrow">Appointment</p>
          <h3 id="appointment-details-title">{appointment.patient.full_name}</h3>
        </div>
        <dl className="detail-grid">
          <div>
            <dt>Time</dt>
            <dd>{formatDateRange(appointment.start_datetime, appointment.end_datetime)}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>
              <AppointmentStatusBadge status={appointment.status} />
            </dd>
          </div>
          <div>
            <dt>Doctor</dt>
            <dd>{appointment.doctor.full_name}</dd>
          </div>
          <div>
            <dt>Reason</dt>
            <dd>{displayText(appointment.reason)}</dd>
          </div>
        </dl>
        <div className="form-actions">
          <button className="button secondary" type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </section>
    </div>
  );
}
