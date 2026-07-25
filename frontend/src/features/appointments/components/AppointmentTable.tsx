import { useNavigate } from "react-router-dom";

import { ActionMenu, ActionMenuItem, ActionMenuSeparator, Button } from "../../../components/v2";
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
  const navigate = useNavigate();
  if (!appointments.length) return <EmptyState title={c.noAppointments} />;

  return (
    <div className="table-scroll">
      <table className="appointment-table">
        <thead>
          <tr>
            <th>{c.time}</th><th>{c.patient}</th><th>{c.doctor}</th><th>{c.reason}</th><th>{c.status}</th>{role === "STAFF" ? <th>{c.action}</th> : null}
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
                {role === "STAFF" ? <td><div className="row-actions">
                  {permissions.canCheckIn ? <Button type="button" compact variant="secondary" onClick={(event) => { event.stopPropagation(); onStatusAction?.(appointment, "check-in"); }}>{c.checkIn}</Button> : null}
                  {(permissions.canEdit || permissions.canReschedule || permissions.canNoShow || permissions.canCancel) ? <ActionMenu label={c.more}>
                    {permissions.canEdit ? <ActionMenuItem onSelect={() => onEdit?.(appointment)}>{c.edit}</ActionMenuItem> : null}
                    {permissions.canReschedule ? <ActionMenuItem onSelect={() => navigate(appointmentReschedulePath(appointment.id))}>{c.reschedule}</ActionMenuItem> : null}
                    {permissions.canNoShow ? <ActionMenuItem onSelect={() => onStatusAction?.(appointment, "no-show")}>{c.noShow}</ActionMenuItem> : null}
                    {permissions.canCancel ? <><ActionMenuSeparator /><ActionMenuItem danger onSelect={() => onStatusAction?.(appointment, "cancel")}>{c.cancel}</ActionMenuItem></> : null}
                  </ActionMenu> : null}
                </div></td> : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
