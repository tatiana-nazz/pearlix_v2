import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { ApiClientError } from "../../api/errors";
import { clinicApi, clinicSettingsQueryKey } from "../../api/endpoints/clinic";
import { useAuthStore } from "../../auth/authStore";
import { BackLink } from "../../components/BackLink";
import { Button, DetailHeader, Modal, StatePanel, SurfaceCard } from "../../components/v2";
import { AppointmentConfirmDialog } from "../../features/appointments/components/AppointmentConfirmDialog";
import { AppointmentForm } from "../../features/appointments/components/AppointmentForm";
import { AppointmentStatusBadge } from "../../features/appointments/components/AppointmentStatusBadge";
import {
  useCancelAppointment,
  useCheckInAppointment,
  useNoShowAppointment,
  useStartAppointmentVisit,
  useUpdateAppointment,
} from "../../features/appointments/hooks/useAppointmentMutations";
import { useAppointment } from "../../features/appointments/hooks/useAppointments";
import { useDoctors } from "../../features/appointments/hooks/useDoctors";
import { appointmentCopy, appointmentStatusLabel } from "../../features/appointments/i18n";
import { formatAppointmentDate, formatAppointmentDateTime, formatAppointmentTime } from "../../features/appointments/utils/appointmentDates";
import { dateFromAppointment } from "../../features/appointments/utils/appointmentFilters";
import { appointmentReschedulePath, appointmentViewPath, getAppointmentPermissions } from "../../features/appointments/utils/appointmentPermissions";
import type { AppointmentDetail, UpdateAppointmentPayload } from "../../types/appointments";
import type { UserRole } from "../../types/auth";
import { displayText } from "../../utils/formatters";

type StatusAction = "check-in" | "cancel" | "no-show" | "start-visit";

interface AppointmentDetailPageProps {
  role: UserRole;
}

interface AppointmentEditModalProps {
  appointment: AppointmentDetail;
  onClose: () => void;
}

function AppointmentEditModal({ appointment, onClose }: AppointmentEditModalProps) {
  const language = useAuthStore((state) => state.user?.language_preference ?? "EN");
  const c = appointmentCopy(language);
  const doctors = useDoctors();
  const update = useUpdateAppointment(appointment.id);
  const clinicSettings = useQuery({ queryKey: clinicSettingsQueryKey, queryFn: clinicApi.getSettings, staleTime: 300_000 });
  const [dirty, setDirty] = useState(false);
  function close(force = false) {
    if (!force && dirty && !window.confirm(language === "AR" ? "هل تريد تجاهل تغييرات الموعد غير المحفوظة؟" : "Discard the unsaved appointment changes?")) return;
    setDirty(false);
    onClose();
  }

  async function submit(payload: UpdateAppointmentPayload) {
    await update.mutateAsync(payload);
    onClose();
  }

  return (
    <Modal open title={c.edit} dirty={dirty} onClose={() => close(true)} wide>
      {doctors.isLoading ? <StatePanel state="loading" title={c.loading} /> : null}
      {doctors.isError ? <StatePanel state="error" title={c.unavailable} action={<Button type="button" variant="secondary" onClick={() => void doctors.refetch()}>{c.retry}</Button>} /> : null}
      {doctors.data ? <AppointmentForm mode="edit" doctors={doctors.data} appointment={appointment} clinicTimezone={clinicSettings.data?.timezone} isSubmitting={update.isPending} error={update.error} onCancel={() => close(false)} onDirtyChange={setDirty} onSubmit={(payload) => submit(payload as UpdateAppointmentPayload)} /> : null}
    </Modal>
  );
}

export function AppointmentDetailPage({ role }: AppointmentDetailPageProps) {
  const navigate = useNavigate();
  const appointmentId = Number(useParams<{ appointmentId: string }>().appointmentId);
  const appointment = useAppointment(appointmentId);
  const language = useAuthStore((state) => state.user?.language_preference ?? "EN");
  const c = appointmentCopy(language);
  const [editOpen, setEditOpen] = useState(false);
  const [action, setAction] = useState<StatusAction | null>(null);
  const checkIn = useCheckInAppointment();
  const cancel = useCancelAppointment();
  const noShow = useNoShowAppointment();
  const startVisit = useStartAppointmentVisit();

  function openAction(nextAction: StatusAction) {
    checkIn.reset();
    cancel.reset();
    noShow.reset();
    startVisit.reset();
    setAction(nextAction);
  }

  async function confirmAction() {
    if (!appointment.data || !action) return;
    if (action === "check-in") await checkIn.mutateAsync(appointment.data.id);
    if (action === "cancel") await cancel.mutateAsync(appointment.data.id);
    if (action === "no-show") await noShow.mutateAsync(appointment.data.id);
    if (action === "start-visit") {
      await startVisit.mutateAsync(appointment.data.id);
      navigate("/doctor/visits/active");
      return;
    }
    setAction(null);
  }

  const backAction = <BackLink to={appointmentViewPath(role, "list")}>{c.backToAppointments}</BackLink>;
  if (!Number.isFinite(appointmentId) || appointmentId <= 0) {
    return <div className="appointment-detail-page"><StatePanel state="notFound" title={c.appointmentNotFound} description={c.appointmentNotFoundDescription} action={backAction} /></div>;
  }
  if (appointment.isLoading) return <div className="appointment-detail-page"><StatePanel state="loading" title={c.loading} /></div>;
  if (appointment.isError || !appointment.data) {
    const notFound = appointment.error instanceof ApiClientError && appointment.error.status === 404;
    return <div className="appointment-detail-page"><StatePanel state={notFound ? "notFound" : "error"} title={notFound ? c.appointmentNotFound : c.unavailable} description={notFound ? c.appointmentNotFoundDescription : undefined} action={notFound ? backAction : <><Button type="button" variant="secondary" onClick={() => void appointment.refetch()}>{c.retry}</Button>{backAction}</>} /></div>;
  }

  const item = appointment.data;
  const permissions = getAppointmentPermissions(role, item);
  const currentMutationError = checkIn.error ?? cancel.error ?? noShow.error ?? startVisit.error;
  const isActionSubmitting = checkIn.isPending || cancel.isPending || noShow.isPending || startVisit.isPending;
  const hasStaffActions = permissions.canEdit || permissions.canReschedule || permissions.canCheckIn || permissions.canNoShow || permissions.canCancel;
  const hasRescheduleContext = Boolean(item.reschedule_source_label || item.reschedule_source_type || item.reschedule_previous_status || item.reschedule_source_exception || item.reschedule_source_working_shift);
  const appointmentDate = dateFromAppointment(item.start_datetime);

  return (
    <div className="appointment-detail-page" data-role={role} data-appointment-id={item.id} data-appointment-date={appointmentDate}>
      <DetailHeader
        title={item.patient.full_name}
        summary={c.detailDescription}
        action={<div className="appointment-detail-header-actions"><AppointmentStatusBadge status={item.status} />{backAction}</div>}
      />

      <SurfaceCard className="appointment-detail-card">
        <dl className="detail-grid appointment-detail-facts">
          <div><dt>{c.date}</dt><dd>{formatAppointmentDate(appointmentDate, language, undefined, { dateStyle: "full" })}</dd></div>
          <div><dt>{c.status}</dt><dd><AppointmentStatusBadge status={item.status} /></dd></div>
          <div><dt>{c.startTime}</dt><dd>{formatAppointmentTime(item.start_datetime, language)}</dd></div>
          <div><dt>{c.endTime}</dt><dd>{formatAppointmentTime(item.end_datetime, language)}</dd></div>
          <div><dt>{c.duration}</dt><dd>{item.duration_minutes} {c.minutes}</dd></div>
          <div><dt>{c.doctor}</dt><dd>{item.doctor.full_name}</dd></div>
          <div><dt>{c.patient}</dt><dd><Link to={`/${role.toLowerCase()}/patients/${item.patient.id}`}>{item.patient.full_name}</Link></dd></div>
          <div><dt>{c.reason}</dt><dd>{displayText(item.reason)}</dd></div>
          <div><dt>{c.created}</dt><dd>{formatAppointmentDateTime(item.created_at, language)}{item.created_by ? <small>{item.created_by.full_name}</small> : null}</dd></div>
          <div><dt>{c.updated}</dt><dd>{formatAppointmentDateTime(item.updated_at, language)}{item.updated_by ? <small>{item.updated_by.full_name}</small> : null}</dd></div>
          {item.notes ? <div className="detail-wide"><dt>{c.notes}</dt><dd>{item.notes}</dd></div> : null}
        </dl>
      </SurfaceCard>

      {hasRescheduleContext ? <SurfaceCard className="appointment-detail-context"><h2>{c.rescheduleContext}</h2><dl className="detail-grid"><div><dt>{c.rescheduleSource}</dt><dd>{displayText(item.reschedule_source_label || item.reschedule_source_type)}</dd></div><div><dt>{c.previousStatus}</dt><dd>{item.reschedule_previous_status ? appointmentStatusLabel(language, item.reschedule_previous_status) : "—"}</dd></div></dl></SurfaceCard> : null}

      {hasStaffActions || permissions.canStartVisit ? <SurfaceCard className="appointment-detail-actions" aria-label={c.action}>
        {permissions.canEdit ? <Button type="button" variant="secondary" onClick={() => setEditOpen(true)}>{c.edit}</Button> : null}
        {permissions.canReschedule ? <Button type="button" variant="secondary" onClick={() => navigate(appointmentReschedulePath(item.id))}>{c.reschedule}</Button> : null}
        {permissions.canCheckIn ? <Button type="button" variant="secondary" onClick={() => openAction("check-in")}>{c.checkIn}</Button> : null}
        {permissions.canNoShow ? <Button type="button" variant="secondary" onClick={() => openAction("no-show")}>{c.noShow}</Button> : null}
        {permissions.canCancel ? <Button type="button" variant="danger" onClick={() => openAction("cancel")}>{c.cancel}</Button> : null}
        {permissions.canStartVisit ? <Button type="button" onClick={() => openAction("start-visit")}>{c.startVisit}</Button> : null}
      </SurfaceCard> : null}

      {editOpen ? <AppointmentEditModal appointment={item} onClose={() => setEditOpen(false)} /> : null}
      <AppointmentConfirmDialog appointment={item} action={action} error={currentMutationError} isSubmitting={isActionSubmitting} onCancel={() => setAction(null)} onConfirm={() => void confirmAction()} />
    </div>
  );
}
