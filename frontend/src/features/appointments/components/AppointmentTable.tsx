import { Link } from "react-router-dom";

import { EmptyState } from "../../../components/EmptyState";
import type { AppointmentListItem } from "../../../types/appointments";
import type { UserRole } from "../../../types/auth";
import { displayText } from "../../../utils/formatters";
import { AppointmentStatusBadge } from "./AppointmentStatusBadge";
import { appointmentReschedulePath, getAppointmentPermissions } from "../utils/appointmentPermissions";
import { useAuthStore } from "../../../auth/authStore";
import { appointmentCopy } from "../i18n";
import { formatAppointmentDateTime } from "../utils/appointmentDates";

interface AppointmentTableProps {
  role: UserRole;
  appointments: AppointmentListItem[];
  timezone?: string;
  onEdit?: (appointment: AppointmentListItem) => void;
  onDetails?: (appointment: AppointmentListItem) => void;
  onStatusAction?: (appointment: AppointmentListItem, action: "check-in" | "cancel" | "no-show") => void;
}

export function AppointmentTable({ role, appointments, timezone, onEdit, onDetails, onStatusAction }: AppointmentTableProps) {
  const language = useAuthStore((state) => state.user?.language_preference ?? "EN");
  const c = appointmentCopy(language);
  if (!appointments.length) return <EmptyState title={c.noAppointments} />;

  return (
    <div className="table-scroll">
      <table className="appointment-table">
        <thead>
          <tr>
            <th>{c.time}</th><th>{c.patient}</th><th>{c.doctor}</th><th>{c.reason}</th><th>{c.status}</th><th>{c.details}</th>
          </tr>
        </thead>
        <tbody>
          {appointments.map((appointment) => {
            const permissions = getAppointmentPermissions(role, appointment);
            return (
              <tr key={appointment.id} className="v2-clickable-row" tabIndex={onDetails ? 0 : undefined} onClick={() => onDetails?.(appointment)} onKeyDown={(event) => { if ((event.key === "Enter" || event.key === " ") && event.target === event.currentTarget) { event.preventDefault(); onDetails?.(appointment); } }}>
                <td>
                  <strong>{formatAppointmentDateTime(appointment.start_datetime, language, timezone)}</strong>
                  <span>{appointment.duration_minutes} {c.minutes}</span>
                </td>
                <td>{appointment.patient.full_name}</td>
                <td>{appointment.doctor.full_name}</td>
                <td>{displayText(appointment.reason)}</td>
                <td>
                  <AppointmentStatusBadge status={appointment.status} />
                </td>
                <td>
                  <div className="row-actions">
                    <button className="button secondary compact-button" type="button" onClick={(event) => { event.stopPropagation(); onDetails?.(appointment); }}>
                      {c.details}
                    </button>
                    {permissions.canEdit ? (
                      <button className="button secondary compact-button" type="button" onClick={(event) => { event.stopPropagation(); onEdit?.(appointment); }}>
                        {c.edit}
                      </button>
                    ) : null}
                    {permissions.canReschedule ? (
                      <Link className="button secondary compact-button" to={appointmentReschedulePath(appointment.id)} onClick={(event) => event.stopPropagation()}>
                        {c.reschedule}
                      </Link>
                    ) : null}
                    {permissions.canCheckIn ? (
                      <button className="button secondary compact-button" type="button" onClick={(event) => { event.stopPropagation(); onStatusAction?.(appointment, "check-in"); }}>
                        {c.checkIn}
                      </button>
                    ) : null}
                    {permissions.canCancel ? (
                      <button className="button secondary compact-button" type="button" onClick={(event) => { event.stopPropagation(); onStatusAction?.(appointment, "cancel"); }}>
                        {c.cancel}
                      </button>
                    ) : null}
                    {permissions.canNoShow ? (
                      <button className="button secondary compact-button" type="button" onClick={(event) => { event.stopPropagation(); onStatusAction?.(appointment, "no-show"); }}>
                        {c.noShow}
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
