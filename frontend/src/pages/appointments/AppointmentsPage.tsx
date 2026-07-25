import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { Button, Modal, SurfaceCard } from "../../components/v2";
import { ErrorState } from "../../components/ErrorState";
import { LoadingState } from "../../components/LoadingState";
import { AppointmentConfirmDialog } from "../../features/appointments/components/AppointmentConfirmDialog";
import { AppointmentDayView } from "../../features/appointments/components/AppointmentDayView";
import { AppointmentDetailsDialog } from "../../features/appointments/components/AppointmentDetailsDialog";
import { AppointmentFilters, type AppointmentStatusFilter } from "../../features/appointments/components/AppointmentFilters";
import { AppointmentForm } from "../../features/appointments/components/AppointmentForm";
import { AppointmentMonthView } from "../../features/appointments/components/AppointmentMonthView";
import { AppointmentTable } from "../../features/appointments/components/AppointmentTable";
import { AppointmentViewTabs } from "../../features/appointments/components/AppointmentViewTabs";
import { AppointmentWeekView } from "../../features/appointments/components/AppointmentWeekView";
import { NeedsRescheduleView } from "../../features/appointments/components/NeedsRescheduleView";
import {
  useCancelAppointment,
  useCheckInAppointment,
  useCreateAppointment,
  useNoShowAppointment,
  useUpdateAppointment,
} from "../../features/appointments/hooks/useAppointmentMutations";
import { useAppointments } from "../../features/appointments/hooks/useAppointments";
import { useDoctors } from "../../features/appointments/hooks/useDoctors";
import { addDays, clinicToday, formatAppointmentDate, isValidDateInput } from "../../features/appointments/utils/appointmentDates";
import { buildAppointmentFilters } from "../../features/appointments/utils/appointmentFilters";
import { getAppointmentPermissions } from "../../features/appointments/utils/appointmentPermissions";
import { appointmentReschedulePath, appointmentViewPath } from "../../features/appointments/utils/appointmentPermissions";
import { appointmentCopy } from "../../features/appointments/i18n";
import { useAuthStore } from "../../auth/authStore";
import type { AppointmentListItem, AppointmentViewMode, CreateAppointmentPayload, UpdateAppointmentPayload } from "../../types/appointments";
import type { UserRole } from "../../types/auth";

interface AppointmentsPageProps {
  role: UserRole;
  view: AppointmentViewMode;
}

type StatusAction = "check-in" | "cancel" | "no-show";

function viewsForRole(role: UserRole): AppointmentViewMode[] {
  if (role === "DOCTOR") return ["day", "week", "list"];
  return ["day", "week", "month", "list"];
}

export function AppointmentsPage({ role, view }: AppointmentsPageProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [formAppointment, setFormAppointment] = useState<AppointmentListItem | null>(null);
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [detailsAppointment, setDetailsAppointment] = useState<AppointmentListItem | null>(null);
  const [actionAppointment, setActionAppointment] = useState<AppointmentListItem | null>(null);
  const [action, setAction] = useState<StatusAction | null>(null);
  const navigate = useNavigate();

  const language = useAuthStore((state) => state.user?.language_preference ?? "EN");
  const c = appointmentCopy(language);
  const timezone = appointmentsTimezone(searchParams.get("timezone"));
  const requestedDate = searchParams.get("date");
  const date = isValidDateInput(requestedDate) ? requestedDate : clinicToday(timezone);
  const status = (searchParams.get("status") || "ALL") as AppointmentStatusFilter;
  const doctorId = searchParams.get("doctor") || "";
  const search = searchParams.get("search") || "";
  const page = Number(searchParams.get("page") || "1");
  const filters = useMemo(
    () =>
      buildAppointmentFilters({
        role,
        view,
        date,
        status,
        page: Number.isFinite(page) && page > 0 ? page : 1,
        doctorId: Number(doctorId) || undefined,
        search: view === "list" ? search || undefined : undefined,
      }),
    [date, doctorId, page, role, search, status, view],
  );
  const appointments = useAppointments(filters);
  const doctors = useDoctors();
  const createAppointment = useCreateAppointment();
  const updateAppointment = useUpdateAppointment(formAppointment?.id ?? 0);
  const checkIn = useCheckInAppointment();
  const cancel = useCancelAppointment();
  const noShow = useNoShowAppointment();
  const permissions = getAppointmentPermissions(role);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    next.set("page", "1");
    setSearchParams(next);
  }

  function openDay(day: string) {
    const next = new URLSearchParams(searchParams);
    next.set("date", day);
    next.set("page", "1");
    navigate(`${appointmentViewPath(role, "day")}?${next.toString()}`);
  }

  async function submitCreate(payload: CreateAppointmentPayload | UpdateAppointmentPayload) {
    await createAppointment.mutateAsync(payload as CreateAppointmentPayload);
    setCreateOpen(false);
  }

  async function submitUpdate(payload: CreateAppointmentPayload | UpdateAppointmentPayload) {
    if (!formAppointment) return;
    await updateAppointment.mutateAsync(payload as UpdateAppointmentPayload);
    setFormAppointment(null);
  }

  function openStatusAction(appointment: AppointmentListItem, nextAction: StatusAction) {
    setActionAppointment(appointment);
    setAction(nextAction);
    checkIn.reset();
    cancel.reset();
    noShow.reset();
  }

  async function confirmStatusAction() {
    if (!actionAppointment || !action) return;
    if (action === "check-in") await checkIn.mutateAsync(actionAppointment.id);
    if (action === "cancel") await cancel.mutateAsync(actionAppointment.id);
    if (action === "no-show") await noShow.mutateAsync(actionAppointment.id);
    setActionAppointment(null);
    setAction(null);
  }

  const rows = appointments.data?.results ?? [];
  const clinicTimezone = appointments.data?.clinic_timezone ?? timezone;
  const clinicDate = appointments.data?.clinic_date ?? clinicToday(clinicTimezone);
  const currentMutationError = checkIn.error ?? cancel.error ?? noShow.error;
  const isActionSubmitting = checkIn.isPending || cancel.isPending || noShow.isPending;

  return (
    <main className="appointments-v2" data-role={role}>
      <header className="appointments-v2-header"><div><p>{formatAppointmentDate(date, language, clinicTimezone, view === "week" ? { month: "short", day: "numeric", year: "numeric" } : { dateStyle: "full" })}</p><h1>{view === "needs-reschedule" ? c.needsReschedule : c.title}</h1><span>{role === "STAFF" ? c.staffDescription : c.readDescription}</span></div><div className="appointments-v2-actions"><Button type="button" variant="secondary" onClick={() => setParam("date", addDays(date, -1))} aria-label={c.previous}>{language === "AR" ? "→" : "←"}</Button><Button type="button" variant="secondary" onClick={() => setParam("date", clinicDate)}>{c.today}</Button><Button type="button" variant="secondary" onClick={() => setParam("date", addDays(date, 1))} aria-label={c.next}>{language === "AR" ? "←" : "→"}</Button><Button type="button" variant="secondary" onClick={() => void appointments.refetch()}>{appointments.isFetching ? c.refreshing : c.refresh}</Button>{permissions.canCreate ? <Button type="button" onClick={() => setCreateOpen(true)}>{c.newAppointment}</Button> : null}</div></header>

      <SurfaceCard>
        <AppointmentViewTabs role={role} views={viewsForRole(role)} />
        <AppointmentFilters
          date={date}
          status={status}
          doctorId={doctorId}
          doctors={doctors.data ?? []}
          showDoctorFilter={role !== "DOCTOR"}
          onDateChange={(value) => setParam("date", value)}
          onStatusChange={(value) => setParam("status", value === "ALL" ? "" : value)}
          onDoctorChange={(value) => setParam("doctor", value)}
        />
        {view === "list" ? <label className="appointments-v2-search">{c.search}<input value={search} onChange={(event) => setParam("search", event.target.value)} /></label> : null}
      </SurfaceCard>

      <SurfaceCard>
        {appointments.isLoading ? <LoadingState title={c.loading} /> : null}
        {appointments.isError ? (
          <ErrorState error={appointments.error} onRetry={() => void appointments.refetch()} title={c.unavailable} />
        ) : null}
        {appointments.data ? (
          <>
            {appointments.isFetching ? <p className="panel-note" aria-live="polite">{c.refreshing}</p> : null}
            {view === "day" ? (
              <AppointmentDayView appointments={rows} timezone={clinicTimezone} onDetails={setDetailsAppointment} />
            ) : null}
            {view === "week" ? <AppointmentWeekView role={role} date={date} timezone={clinicTimezone} appointments={rows} onDetails={setDetailsAppointment} onDaySelect={openDay} /> : null}
            {view === "month" ? <AppointmentMonthView date={date} timezone={clinicTimezone} appointments={rows} onDetails={setDetailsAppointment} onDaySelect={openDay} /> : null}
            {view === "list" ? (
              <AppointmentTable appointments={rows} timezone={clinicTimezone} onDetails={setDetailsAppointment} />
            ) : null}
            {view === "needs-reschedule" ? (
              <NeedsRescheduleView appointments={rows} onDetails={setDetailsAppointment} />
            ) : null}
            <div className="pagination-bar">
              <span>{appointments.data.count} {c.records}</span>
              <div>
                <button className="button secondary" type="button" disabled={!appointments.data.previous || page <= 1} onClick={() => setParam("page", String(page - 1))}>
                  {c.previousPage}
                </button>
                <span>{c.page} {page}</span>
                <button className="button secondary" type="button" disabled={!appointments.data.next} onClick={() => setParam("page", String(page + 1))}>
                  {c.nextPage}
                </button>
              </div>
            </div>
          </>
        ) : null}
      </SurfaceCard>

      {isCreateOpen ? (
          <Modal open title={c.newAppointment} onClose={() => setCreateOpen(false)} wide>
            <AppointmentForm
              mode="create"
              doctors={doctors.data ?? []}
              initialDate={date}
              initialDoctorId={Number(doctorId) || undefined}
              isSubmitting={createAppointment.isPending}
              error={createAppointment.error}
              onCancel={() => setCreateOpen(false)}
              onSubmit={submitCreate}
            />
          </Modal>
      ) : null}

      {formAppointment ? (
          <Modal open title={c.edit} onClose={() => setFormAppointment(null)} wide>
            <AppointmentForm
              mode={formAppointment.status === "NEEDS_RESCHEDULE" ? "reschedule" : "edit"}
              doctors={doctors.data ?? []}
              appointment={formAppointment}
              isSubmitting={updateAppointment.isPending}
              error={updateAppointment.error}
              onCancel={() => setFormAppointment(null)}
              onSubmit={submitUpdate}
            />
          </Modal>
      ) : null}

      <AppointmentDetailsDialog
        appointment={detailsAppointment}
        role={role}
        timezone={clinicTimezone}
        onClose={() => setDetailsAppointment(null)}
        onEdit={(appointment) => { setDetailsAppointment(null); setFormAppointment(appointment); }}
        onReschedule={(appointment) => navigate(appointmentReschedulePath(appointment.id))}
        onStatusAction={(appointment, nextAction) => { setDetailsAppointment(null); openStatusAction(appointment, nextAction); }}
      />
      <AppointmentConfirmDialog
        appointment={actionAppointment}
        action={action}
        error={currentMutationError}
        isSubmitting={isActionSubmitting}
        onCancel={() => setActionAppointment(null)}
        onConfirm={() => void confirmStatusAction()}
      />
    </main>
  );
}

function appointmentsTimezone(value: string | null): string | undefined {
  return value || undefined;
}
