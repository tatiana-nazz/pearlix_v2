import { Link } from "react-router-dom";

import { EmptyState } from "../../../components/EmptyState";
import type { AppointmentListItem } from "../../../types/appointments";
import type { UserRole } from "../../../types/auth";
import { formatDateTime } from "../../../utils/dates";
import { displayText } from "../../../utils/formatters";
import { AppointmentStatusBadge } from "./AppointmentStatusBadge";
import { ClickableRow } from "../../../components/v2";
import { appointmentReschedulePath, getAppointmentPermissions } from "../utils/appointmentPermissions";

interface AppointmentTableProps {
  role: UserRole;
  appointments: AppointmentListItem[];
  onEdit?: (appointment: AppointmentListItem) => void;
  onDetails?: (appointment: AppointmentListItem) => void;
  onStatusAction?: (appointment: AppointmentListItem, action: "check-in" | "cancel" | "no-show" | "start-visit") => void;
}

export function AppointmentTable({ role, appointments, onEdit, onDetails, onStatusAction }: AppointmentTableProps) {
  if (!appointments.length) return <EmptyState title="No appointments found for this view." />;

  return (
    <div className="table-scroll">
      <table className="appointment-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Patient</th>
            <th>Doctor</th>
            <th>Reason</th>
            <th>Status</th>
            <th>Actions</th><th aria-label="Open appointment" />
          </tr>
        </thead>
        <tbody>
          {appointments.map((appointment) => {
            const permissions = getAppointmentPermissions(role, appointment);
            return (
              <ClickableRow key={appointment.id} onOpen={() => onDetails?.(appointment)}>
                <td>
                  <strong>{formatDateTime(appointment.start_datetime)}</strong>
                  <span>{appointment.duration_minutes} min</span>
                </td>
                <td>{appointment.patient.full_name}</td>
                <td>{appointment.doctor.full_name}</td>
                <td>{displayText(appointment.reason)}</td>
                <td>
                  <AppointmentStatusBadge status={appointment.status} />
                </td>
                <td data-row-action>
                  <div className="row-actions">
                    {permissions.canEdit ? (
                      <button className="button secondary compact-button" type="button" onClick={() => onEdit?.(appointment)}>
                        Edit
                      </button>
                    ) : null}
                    {permissions.canReschedule ? (
                      <Link data-row-action className="button secondary compact-button" to={appointmentReschedulePath(appointment.id)}>
                        Reschedule
                      </Link>
                    ) : null}
                    {permissions.canCheckIn ? (
                      <button className="button secondary compact-button" type="button" onClick={() => onStatusAction?.(appointment, "check-in")}>
                        Check in
                      </button>
                    ) : null}
                    {permissions.canCancel ? (
                      <button className="button secondary compact-button" type="button" onClick={() => onStatusAction?.(appointment, "cancel")}>
                        Cancel
                      </button>
                    ) : null}
                    {permissions.canNoShow ? (
                      <button className="button secondary compact-button" type="button" onClick={() => onStatusAction?.(appointment, "no-show")}>
                        No-show
                      </button>
                    ) : null}
                    {permissions.canStartVisit ? (
                      <button className="button primary compact-button" type="button" onClick={() => onStatusAction?.(appointment, "start-visit")}>
                        Start Visit
                      </button>
                    ) : null}
                  </div>
                </td>
              </ClickableRow>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
