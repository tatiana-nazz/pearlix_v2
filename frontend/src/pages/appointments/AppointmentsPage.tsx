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
import { AppointmentViewTabs, AppointmentWorkspaceTabs } from "../../features/appointments/components/AppointmentViewTabs";
import { AppointmentWeekView } from "../../features/appointments/components/AppointmentWeekView";
import { NeedsRescheduleView } from "../../features/appointments/components/NeedsRescheduleView";
import {
  useCancelAppointment,
  useCheckInAppointment,
  useCreateAppointment,
  useNoShowAppointment,
  useStartAppointmentVisit,
  useUpdateAppointment,
} from "../../features/appointments/hooks/useAppointmentMutations";
import { useAppointments } from "../../features/appointments/hooks/useAppointments";
import { useDoctors } from "../../features/appointments/hooks/useDoctors";
import { addDays, addMonths, clinicToday, formatAppointmentDate, getWeekRange, isValidDateInput } from "../../features/appointments/utils/appointmentDates";
import { buildAppointmentFilters } from "../../features/appointments/utils/appointmentFilters";
import { getAppointmentPermissions } from "../../features/appointments/utils/appointmentPermissions";
import { appointmentReschedulePath, appointmentViewPath } from "../../features/appointments/utils/appointmentPermissions";
import { appointmentCopy, appointmentStatusLabel } from "../../features/appointments/i18n";
import { useAuthStore } from "../../auth/authStore";
import type { AppointmentListItem, AppointmentStatus, AppointmentViewMode, CreateAppointmentPayload, UpdateAppointmentPayload } from "../../types/appointments";
import type { UserRole } from "../../types/auth";

interface AppointmentsPageProps { role: UserRole; view: AppointmentViewMode; }
type StatusAction = "check-in" | "cancel" | "no-show" | "start-visit";
const calendarViews: AppointmentViewMode[] = ["day", "week", "month", "list"];

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
  const queue = view === "needs-reschedule";
  const filters = useMemo(() => buildAppointmentFilters({
    role,
    view,
    date,
    status,
    page: Number.isFinite(page) && page > 0 ? page : 1,
    doctorId: Number(doctorId) || undefined,
    search: search || undefined,
  }), [date, doctorId, page, role, search, status, view]);
  const appointments = useAppointments(filters);
  const doctors = useDoctors();
  const createAppointment = useCreateAppointment();
  const updateAppointment = useUpdateAppointment(formAppointment?.id ?? 0);
  const checkIn = useCheckInAppointment();
  const cancel = useCancelAppointment();
  const noShow = useNoShowAppointment();
  const startVisit = useStartAppointmentVisit();
  const permissions = getAppointmentPermissions(role);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value); else next.delete(key);
    next.set("page", "1");
    setSearchParams(next);
  }

  function openDay(day: string) {
    const next = new URLSearchParams(searchParams);
    next.set("date", day);
    next.set("page", "1");
    navigate(`${appointmentViewPath(role, "day")}?${next.toString()}`);
  }

  function shiftDate(direction: -1 | 1) {
    if (view === "month") setParam("date", addMonths(date, direction));
    else setParam("date", addDays(date, direction * (view === "week" ? 7 : 1)));
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
    checkIn.reset(); cancel.reset(); noShow.reset(); startVisit.reset();
  }

  async function confirmStatusAction() {
    if (!actionAppointment || !action) return;
    if (action === "check-in") await checkIn.mutateAsync(actionAppointment.id);
    if (action === "cancel") await cancel.mutateAsync(actionAppointment.id);
    if (action === "no-show") await noShow.mutateAsync(actionAppointment.id);
    if (action === "start-visit") { await startVisit.mutateAsync(actionAppointment.id); navigate("/doctor/visits/active"); }
    setActionAppointment(null);
    setAction(null);
  }

  const rows = appointments.data?.results ?? [];
  const clinicTimezone = appointments.data?.clinic_timezone ?? timezone;
  const clinicDate = appointments.data?.clinic_date ?? clinicToday(clinicTimezone);
  const currentMutationError = checkIn.error ?? cancel.error ?? noShow.error ?? startVisit.error;
  const isActionSubmitting = checkIn.isPending || cancel.isPending || noShow.isPending || startVisit.isPending;
  const statusSummary = Object.entries(rows.reduce<Partial<Record<AppointmentStatus, number>>>((summary, appointment) => {
    summary[appointment.status] = (summary[appointment.status] ?? 0) + 1;
    return summary;
  }, {}));
  const navigationLabel = view === "week"
    ? (() => { const range = getWeekRange(date); return `${formatAppointmentDate(range.start, language, clinicTimezone, { month: "short", day: "numeric" })} – ${formatAppointmentDate(range.end, language, clinicTimezone, { month: "short", day: "numeric", year: "numeric" })}`; })()
    : formatAppointmentDate(date, language, clinicTimezone, view === "month" ? { month: "long", year: "numeric" } : { dateStyle: "full" });

  return (
    <main className="appointments-v2" data-role={role}>
      <header className="appointments-v2-header"><div><h1>{c.title}</h1><span>{role === "STAFF" ? c.staffDescription : c.readDescription}</span></div><div className="appointments-v2-actions">{permissions.canCreate ? <Button type="button" onClick={() => setCreateOpen(true)}>{c.newAppointment}</Button> : null}</div></header>

      <SurfaceCard className="appointments-navigation-card">
        <div className="appointments-navigation-row"><AppointmentWorkspaceTabs role={role} queue={queue} />{!queue ? <AppointmentViewTabs role={role} views={calendarViews} /> : null}</div>
        {!queue ? <div className="appointments-date-navigation"><Button type="button" variant="ghost" onClick={() => shiftDate(-1)} aria-label={c.previous}>{language === "AR" ? "→" : "←"}</Button><strong>{navigationLabel}</strong><Button type="button" variant="ghost" onClick={() => shiftDate(1)} aria-label={c.next}>{language === "AR" ? "←" : "→"}</Button><Button type="button" variant="secondary" onClick={() => setParam("date", clinicDate)}>{c.today}</Button></div> : <p className="appointments-queue-intro">{c.queueDescription}</p>}
      </SurfaceCard>

      <SurfaceCard className="appointments-filter-card">
        <label className="appointments-v2-search"><span>{c.search}</span><input value={search} onChange={(event) => setParam("search", event.target.value)} placeholder={c.search} /></label>
        <AppointmentFilters status={status} doctorId={doctorId} doctors={doctors.data ?? []} showDoctorFilter={role !== "DOCTOR"} showStatusFilter={!queue} onStatusChange={(value) => setParam("status", value === "ALL" ? "" : value)} onDoctorChange={(value) => setParam("doctor", value)} />
      </SurfaceCard>

      <div className={view === "week" ? "appointments-content-grid" : "appointments-content-grid single"}>
        <SurfaceCard className="appointments-schedule-card">
          {appointments.isLoading ? <LoadingState title={c.loading} /> : null}
          {appointments.isError ? <ErrorState error={appointments.error} onRetry={() => void appointments.refetch()} title={c.unavailable} /> : null}
          {appointments.data ? <>
            {appointments.isFetching ? <p className="panel-note" aria-live="polite">{c.refreshing}</p> : null}
            {view === "day" ? <AppointmentDayView appointments={rows} timezone={clinicTimezone} onDetails={setDetailsAppointment} /> : null}
            {view === "week" ? <AppointmentWeekView role={role} date={date} timezone={clinicTimezone} appointments={rows} onDetails={setDetailsAppointment} onDaySelect={openDay} /> : null}
            {view === "month" ? <AppointmentMonthView date={date} timezone={clinicTimezone} appointments={rows} onDetails={setDetailsAppointment} onDaySelect={openDay} /> : null}
            {view === "list" ? <AppointmentTable appointments={rows} timezone={clinicTimezone} onDetails={setDetailsAppointment} /> : null}
            {view === "needs-reschedule" ? <NeedsRescheduleView appointments={rows} timezone={clinicTimezone} onDetails={setDetailsAppointment} /> : null}
            <div className="pagination-bar"><span>{appointments.data.count} {c.records}</span><div><button className="button secondary" type="button" disabled={!appointments.data.previous || page <= 1} onClick={() => setParam("page", String(page - 1))}>{c.previousPage}</button><span>{c.page} {page}</span><button className="button secondary" type="button" disabled={!appointments.data.next} onClick={() => setParam("page", String(page + 1))}>{c.nextPage}</button></div></div>
          </> : null}
        </SurfaceCard>
        {view === "week" && appointments.data ? <aside className="appointments-summary-rail" aria-label={c.weekSummary}><SurfaceCard><h2>{c.weekSummary}</h2><dl><div><dt>{c.total}</dt><dd>{rows.length}</dd></div>{statusSummary.map(([summaryStatus, count]) => <div key={summaryStatus}><dt>{appointmentStatusLabel(language, summaryStatus as AppointmentStatus)}</dt><dd>{count}</dd></div>)}</dl></SurfaceCard></aside> : null}
      </div>

      {isCreateOpen ? <Modal open title={c.newAppointment} onClose={() => setCreateOpen(false)} wide><AppointmentForm mode="create" doctors={doctors.data ?? []} initialDate={date} initialDoctorId={Number(doctorId) || undefined} isSubmitting={createAppointment.isPending} error={createAppointment.error} onCancel={() => setCreateOpen(false)} onSubmit={submitCreate} /></Modal> : null}
      {formAppointment ? <Modal open title={c.edit} onClose={() => setFormAppointment(null)} wide><AppointmentForm mode={formAppointment.status === "NEEDS_RESCHEDULE" ? "reschedule" : "edit"} doctors={doctors.data ?? []} appointment={formAppointment} isSubmitting={updateAppointment.isPending} error={updateAppointment.error} onCancel={() => setFormAppointment(null)} onSubmit={submitUpdate} /></Modal> : null}
      <AppointmentDetailsDialog appointment={detailsAppointment} role={role} timezone={clinicTimezone} onClose={() => setDetailsAppointment(null)} onEdit={(appointment) => { setDetailsAppointment(null); setFormAppointment(appointment); }} onReschedule={(appointment) => navigate(appointmentReschedulePath(appointment.id))} onStatusAction={(appointment, nextAction) => { setDetailsAppointment(null); openStatusAction(appointment, nextAction); }} onStartVisit={(appointment) => { setDetailsAppointment(null); openStatusAction(appointment, "start-visit"); }} />
      <AppointmentConfirmDialog appointment={actionAppointment} action={action} error={currentMutationError} isSubmitting={isActionSubmitting} onCancel={() => setActionAppointment(null)} onConfirm={() => void confirmStatusAction()} />
    </main>
  );
}

function appointmentsTimezone(value: string | null): string | undefined { return value || undefined; }
