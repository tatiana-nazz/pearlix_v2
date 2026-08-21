import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";

import { clinicApi, clinicSettingsQueryKey } from "../../api/endpoints/clinic";
import { Button, Modal, SurfaceCard } from "../../components/v2";
import { ErrorState } from "../../components/ErrorState";
import { LoadingState } from "../../components/LoadingState";
import { AppointmentDayView } from "../../features/appointments/components/AppointmentDayView";
import { AppointmentFilters, type AppointmentStatusFilter } from "../../features/appointments/components/AppointmentFilters";
import { AppointmentForm } from "../../features/appointments/components/AppointmentForm";
import { AppointmentMonthView } from "../../features/appointments/components/AppointmentMonthView";
import { AppointmentPeriodSummary } from "../../features/appointments/components/AppointmentPeriodSummary";
import { AppointmentTable } from "../../features/appointments/components/AppointmentTable";
import { AppointmentViewTabs, AppointmentWorkspaceTabs } from "../../features/appointments/components/AppointmentViewTabs";
import { AppointmentWeekView } from "../../features/appointments/components/AppointmentWeekView";
import { NeedsRescheduleView } from "../../features/appointments/components/NeedsRescheduleView";
import { useCreateAppointment } from "../../features/appointments/hooks/useAppointmentMutations";
import { useAppointments } from "../../features/appointments/hooks/useAppointments";
import { useDoctors } from "../../features/appointments/hooks/useDoctors";
import { addDays, addMonths, clinicToday, formatAppointmentDate, getWeekRange, isValidDateInput } from "../../features/appointments/utils/appointmentDates";
import { buildAppointmentFilters } from "../../features/appointments/utils/appointmentFilters";
import { getAppointmentPermissions } from "../../features/appointments/utils/appointmentPermissions";
import { appointmentDetailPath, appointmentViewPath } from "../../features/appointments/utils/appointmentPermissions";
import { appointmentCopy } from "../../features/appointments/i18n";
import { useAuthStore } from "../../auth/authStore";
import type { AppointmentListItem, AppointmentViewMode, CreateAppointmentPayload, UpdateAppointmentPayload } from "../../types/appointments";
import type { UserRole } from "../../types/auth";
import { isClinicClosedDate } from "../../utils/clinicWeek";

interface AppointmentsPageProps { role: UserRole; view: AppointmentViewMode; }
const calendarViews: AppointmentViewMode[] = ["day", "week", "month", "list"];

export function AppointmentsPage({ role, view }: AppointmentsPageProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [createDirty, setCreateDirty] = useState(false);
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
  const clinicSettings = useQuery({ queryKey: clinicSettingsQueryKey, queryFn: clinicApi.getSettings, staleTime: 300_000 });
  const doctors = useDoctors();
  const createAppointment = useCreateAppointment();
  const permissions = getAppointmentPermissions(role);
  function closeCreate(force = false) {
    if (!force && createDirty && !window.confirm(language === "AR" ? "هل تريد تجاهل بيانات الموعد غير المحفوظة؟" : "Discard the unsaved appointment details?")) return;
    setCreateDirty(false);
    setCreateOpen(false);
  }

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value); else next.delete(key);
    next.set("page", "1");
    setSearchParams(next);
  }

  function openDay(day: string) {
    const next = new URLSearchParams();
    for (const key of ["doctor", "status", "search"] as const) {
      const value = searchParams.get(key);
      if (value) next.set(key, value);
    }
    next.set("date", day);
    next.set("page", "1");
    navigate(`${appointmentViewPath(role, "day")}?${next.toString()}`);
  }

  function openAppointment(appointment: AppointmentListItem) {
    navigate(appointmentDetailPath(role, appointment.id));
  }

  function shiftDate(direction: -1 | 1) {
    if (view === "month") setParam("date", addMonths(date, direction));
    else setParam("date", addDays(date, direction * (view === "week" ? 7 : 1)));
  }

  async function submitCreate(payload: CreateAppointmentPayload | UpdateAppointmentPayload) {
    await createAppointment.mutateAsync(payload as CreateAppointmentPayload);
    setCreateOpen(false);
  }

  const rows = appointments.data?.results ?? [];
  const clinicTimezone = appointments.data?.clinic_timezone ?? timezone;
  const clinicDate = appointments.data?.clinic_date ?? clinicToday(clinicTimezone);
  const weeklyClosedDays = clinicSettings.data?.weekly_closed_days ?? [];
  const navigationLabel = view === "week"
    ? (() => { const range = getWeekRange(date); return `${formatAppointmentDate(range.start, language, clinicTimezone, { month: "short", day: "numeric" })} – ${formatAppointmentDate(range.end, language, clinicTimezone, { month: "short", day: "numeric", year: "numeric" })}`; })()
    : formatAppointmentDate(date, language, clinicTimezone, view === "month" ? { month: "long", year: "numeric" } : { dateStyle: "full" });

  return (
    <div className="appointments-v2" data-role={role}>
      <header className="appointments-v2-header"><div><h1>{c.title}</h1><span>{role === "STAFF" ? c.staffDescription : c.readDescription}</span></div><div className="appointments-v2-actions">{permissions.canCreate ? <Button type="button" onClick={() => setCreateOpen(true)}>{c.newAppointment}</Button> : null}</div></header>

      <SurfaceCard className="appointments-navigation-card">
        <div className="appointments-control-bar"><div className="appointments-date-navigation"><Button type="button" variant="ghost" onClick={() => shiftDate(-1)} aria-label={c.previous}>{language === "AR" ? "→" : "←"}</Button><strong>{navigationLabel}</strong><Button type="button" variant="ghost" onClick={() => shiftDate(1)} aria-label={c.next}>{language === "AR" ? "←" : "→"}</Button><Button type="button" variant="secondary" onClick={() => setParam("date", clinicDate)}>{c.today}</Button></div><div className="appointments-view-controls"><AppointmentWorkspaceTabs role={role} queue={queue} view={view} /><AppointmentViewTabs role={role} views={calendarViews} /></div></div>
        {queue ? <p className="appointments-queue-intro">{c.queueDescription}</p> : null}
      </SurfaceCard>

      <SurfaceCard className="appointments-filter-card">
        <label className="appointments-v2-search"><span>{c.search}</span><input value={search} onChange={(event) => setParam("search", event.target.value)} placeholder={c.search} /></label>
        <AppointmentFilters status={status} doctorId={doctorId} doctors={doctors.data ?? []} showDoctorFilter={role !== "DOCTOR"} showStatusFilter={!queue} onStatusChange={(value) => setParam("status", value === "ALL" ? "" : value)} onDoctorChange={(value) => setParam("doctor", value)} />
      </SurfaceCard>

      <div className={["day", "week", "month"].includes(view) ? "appointments-content-grid" : "appointments-content-grid single"}>
        <SurfaceCard className="appointments-schedule-card">
          {appointments.isLoading ? <LoadingState title={c.loading} /> : null}
          {appointments.isError ? <ErrorState error={appointments.error} onRetry={() => void appointments.refetch()} title={c.unavailable} /> : null}
          {appointments.data ? <>
            {appointments.isFetching ? <p className="panel-note" aria-live="polite">{c.refreshing}</p> : null}
            {view === "day" && isClinicClosedDate(date, weeklyClosedDays) ? <p className="appointment-day-closed" role="status">{c.clinicClosed}</p> : null}
            {view === "day" ? <AppointmentDayView appointments={rows} timezone={clinicTimezone} onDetails={openAppointment} /> : null}
            {view === "week" ? <AppointmentWeekView role={role} date={date} timezone={clinicTimezone} appointments={rows} onDetails={openAppointment} onDaySelect={openDay} weeklyClosedDays={weeklyClosedDays} /> : null}
            {view === "month" ? <AppointmentMonthView date={date} timezone={clinicTimezone} appointments={rows} onDetails={openAppointment} onDaySelect={openDay} weeklyClosedDays={weeklyClosedDays} /> : null}
            {view === "list" ? <AppointmentTable appointments={rows} timezone={clinicTimezone} onDetails={openAppointment} /> : null}
            {view === "needs-reschedule" ? <NeedsRescheduleView appointments={rows} timezone={clinicTimezone} onDetails={openAppointment} /> : null}
            <div className="pagination-bar"><span>{appointments.data.count} {c.records}</span><div><button className="button secondary" type="button" disabled={!appointments.data.previous || page <= 1} onClick={() => setParam("page", String(page - 1))}>{c.previousPage}</button><span>{c.page} {page}</span><button className="button secondary" type="button" disabled={!appointments.data.next} onClick={() => setParam("page", String(page + 1))}>{c.nextPage}</button></div></div>
          </> : null}
        </SurfaceCard>
        {["day", "week", "month"].includes(view) && appointments.data ? <AppointmentPeriodSummary rows={rows} total={appointments.data.count} language={language} periodLabel={view === "day" ? c.daySummary : view === "month" ? c.monthSummary : c.weekSummary} totalLabel={c.periodTotal} loadedLabel={c.loadedStatusSummary} /> : null}
      </div>

      {isCreateOpen ? <Modal open title={c.newAppointment} dirty={createDirty} onClose={() => closeCreate(true)} wide><AppointmentForm mode="create" doctors={doctors.data ?? []} clinicTimezone={clinicTimezone} initialDate={date} initialDoctorId={Number(doctorId) || undefined} isSubmitting={createAppointment.isPending} error={createAppointment.error} onCancel={() => closeCreate(false)} onDirtyChange={setCreateDirty} onSubmit={submitCreate} /></Modal> : null}
    </div>
  );
}

function appointmentsTimezone(value: string | null): string | undefined { return value || undefined; }
