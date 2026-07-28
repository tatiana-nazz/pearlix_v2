import { useEffect, useMemo, useState } from "react";
import { NavLink, useNavigate, useSearchParams } from "react-router-dom";

import { Card } from "../../components/Card";
import { ErrorState } from "../../components/ErrorState";
import { LoadingState } from "../../components/LoadingState";
import { PageHeader } from "../../components/PageHeader";
import { Button, ConfirmDialog, Modal, StatePanel } from "../../components/v2";
import { useFeatureT } from "../../layouts/i18n";
import { AppointmentDayView } from "../../features/appointments/components/AppointmentDayView";
import { AppointmentFilters, type AppointmentStatusFilter } from "../../features/appointments/components/AppointmentFilters";
import { AppointmentForm } from "../../features/appointments/components/AppointmentForm";
import { AppointmentMonthView } from "../../features/appointments/components/AppointmentMonthView";
import { AppointmentTable } from "../../features/appointments/components/AppointmentTable";
import { AppointmentWeekView } from "../../features/appointments/components/AppointmentWeekView";
import { AppointmentCalendarToolbar } from "../../features/appointments/components/AppointmentCalendarToolbar";
import { AppointmentCalendarSummary } from "../../features/appointments/components/AppointmentCalendarSummary";
import { NeedsRescheduleView } from "../../features/appointments/components/NeedsRescheduleView";
import { AppointmentDetailsModal } from "../../features/appointments/components/AppointmentDetailsModal";
import { useCancelAppointment, useCheckInAppointment, useCreateAppointment, useNoShowAppointment, useStartAppointmentVisit, useUpdateAppointment } from "../../features/appointments/hooks/useAppointmentMutations";
import { useAppointmentRange, useAppointments } from "../../features/appointments/hooks/useAppointments";
import { useDoctors } from "../../features/appointments/hooks/useDoctors";
import { useClinicSafeSettings } from "../../features/appointments/hooks/useClinicSafeSettings";
import { usePatients } from "../../features/patients/hooks/usePatients";
import { addDays, addMonths, todayInputValue } from "../../features/appointments/utils/appointmentDates";
import { buildAppointmentFilters } from "../../features/appointments/utils/appointmentFilters";
import { appointmentViewPath, getAppointmentPermissions } from "../../features/appointments/utils/appointmentPermissions";
import type { AppointmentListItem, AppointmentViewMode, CreateAppointmentPayload, UpdateAppointmentPayload } from "../../types/appointments";
import type { UserRole } from "../../types/auth";

interface AppointmentsPageProps { role: UserRole; view: AppointmentViewMode; }
type StatusAction = "check-in" | "cancel" | "no-show" | "start-visit";
type FormMode = "edit" | "reschedule" | null;

function useDebouncedValue(value: string, delay = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => { const timer = window.setTimeout(() => setDebounced(value), delay); return () => window.clearTimeout(timer); }, [delay, value]);
  return debounced;
}

function viewsForRole(role: UserRole): AppointmentViewMode[] { return role === "DOCTOR" ? ["day", "week", "list"] : ["day", "week", "month", "list"]; }

export function AppointmentsPage({ role, view }: AppointmentsPageProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [formAppointment, setFormAppointment] = useState<AppointmentListItem | null>(null);
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [createDirty, setCreateDirty] = useState(false);
  const [formDirty, setFormDirty] = useState(false);
  const [patientSearch, setPatientSearch] = useState("");
  const [actionAppointment, setActionAppointment] = useState<AppointmentListItem | null>(null);
  const [action, setAction] = useState<StatusAction | null>(null);
  const navigate = useNavigate(); const t = useFeatureT();
  const date = searchParams.get("date") || todayInputValue(); const status = (searchParams.get("status") || "ALL") as AppointmentStatusFilter; const doctorId = searchParams.get("doctor") || ""; const page = Number(searchParams.get("page") || "1"); const appointmentParam = searchParams.get("appointment"); const appointmentId = appointmentParam && /^\d+$/.test(appointmentParam) && Number(appointmentParam) > 0 ? Number(appointmentParam) : null;
  const calendarView = view === "day" || view === "week" || view === "month";
  const filters = useMemo(() => buildAppointmentFilters({ role, view, date, status, page: Number.isFinite(page) && page > 0 ? page : 1, doctorId: Number(doctorId) || undefined }), [date, doctorId, page, role, status, view]);
  const rangeFilters = useMemo(() => buildAppointmentFilters({ role, view, date, status, doctorId: Number(doctorId) || undefined }), [date, doctorId, role, status, view]);
  const patientSearchDebounced = useDebouncedValue(patientSearch);
  const appointments = useAppointments(filters, !calendarView); const rangeAppointments = useAppointmentRange(rangeFilters, calendarView); const doctors = useDoctors(); const clinicSettings = useClinicSafeSettings(); const patients = usePatients({ page: 1, search: patientSearchDebounced || undefined, is_archived: false });
  const createAppointment = useCreateAppointment(); const updateAppointment = useUpdateAppointment(formAppointment?.id ?? 0); const checkIn = useCheckInAppointment(); const cancel = useCancelAppointment(); const noShow = useNoShowAppointment(); const startVisit = useStartAppointmentVisit(); const permissions = getAppointmentPermissions(role);
  function setParam(key: string, value: string) { const next = new URLSearchParams(searchParams); if (value) next.set(key, value); else next.delete(key); next.set("page", "1"); setSearchParams(next); }
  function openDetails(appointment: AppointmentListItem) { const next = new URLSearchParams(searchParams); next.set("appointment", String(appointment.id)); setSearchParams(next); }
  function closeDetails() { const next = new URLSearchParams(searchParams); next.delete("appointment"); setSearchParams(next); }
  function setCalendarDate(value: string) { setParam("date", value); }
  function shiftPeriod(direction: -1 | 1) { if (!calendarView) return; setCalendarDate(view === "day" ? addDays(date, direction) : view === "week" ? addDays(date, direction * 7) : addMonths(date, direction)); }
  function openDay(value: string) { const next = new URLSearchParams(searchParams); next.set("date", value); next.set("page", "1"); navigate({ pathname: appointmentViewPath(role, "day"), search: `?${next.toString()}` }); }
  function openCreate() { setPatientSearch(""); setCreateDirty(false); setCreateOpen(true); }
  function openForm(appointment: AppointmentListItem, mode: Exclude<FormMode, null>) { closeDetails(); setPatientSearch(""); setFormDirty(false); setFormAppointment(appointment); setFormMode(mode); }
  function closeForm() { const returnToDetails = Boolean(formAppointment && !formDirty); const current = formAppointment; setFormDirty(false); setFormAppointment(null); setFormMode(null); if (returnToDetails && current) { const next = new URLSearchParams(searchParams); next.set("appointment", String(current.id)); setSearchParams(next); } }
  async function submitCreate(payload: CreateAppointmentPayload | UpdateAppointmentPayload) { await createAppointment.mutateAsync(payload as CreateAppointmentPayload); setCreateDirty(false); setCreateOpen(false); }
  async function submitUpdate(payload: CreateAppointmentPayload | UpdateAppointmentPayload) { if (!formAppointment) return; await updateAppointment.mutateAsync(payload as UpdateAppointmentPayload); setFormDirty(false); setFormAppointment(null); setFormMode(null); const next = new URLSearchParams(searchParams); next.set("appointment", String(formAppointment.id)); setSearchParams(next); }
  function restoreActionDetails(appointment: AppointmentListItem | null) { if (!appointment) return; const next = new URLSearchParams(searchParams); next.set("appointment", String(appointment.id)); setSearchParams(next); }
  function openStatusAction(appointment: AppointmentListItem, nextAction: StatusAction) { closeDetails(); setActionAppointment(appointment); setAction(nextAction); checkIn.reset(); cancel.reset(); noShow.reset(); startVisit.reset(); }
  async function confirmStatusAction() { if (!actionAppointment || !action) return; if (action === "check-in") await checkIn.mutateAsync(actionAppointment.id); if (action === "cancel") await cancel.mutateAsync(actionAppointment.id); if (action === "no-show") await noShow.mutateAsync(actionAppointment.id); if (action === "start-visit") { await startVisit.mutateAsync(actionAppointment.id); setActionAppointment(null); setAction(null); navigate("/doctor/visits/active"); return; } const completed = actionAppointment; setActionAppointment(null); setAction(null); restoreActionDetails(completed); }
  useEffect(() => { if (appointmentParam && appointmentId === null) closeDetails(); }, [appointmentId, appointmentParam]);
  const rows = calendarView ? rangeAppointments.data ?? [] : appointments.data?.results ?? []; const activeQuery = calendarView ? rangeAppointments : appointments; const currentMutationError = checkIn.error ?? cancel.error ?? noShow.error ?? startVisit.error; const isActionSubmitting = checkIn.isPending || cancel.isPending || noShow.isPending || startVisit.isPending;
  const workspace = role === "STAFF" ? t("staffWorkspace") : role === "DOCTOR" ? t("doctorWorkspace") : t("adminWorkspace");
  const description = role === "STAFF" ? t("appointmentWorkspaceStaff") : role === "DOCTOR" ? t("appointmentWorkspaceDoctor") : t("appointmentWorkspaceAdmin");
  const viewTitle: Record<AppointmentViewMode, string> = { day: t("dayAppointments"), week: t("weekAppointments"), month: t("monthAppointments"), list: t("appointmentList"), "needs-reschedule": t("needsReschedule") };
  const actionCopy: Record<StatusAction, string> = { "check-in": t("checkIn"), cancel: t("cancelAppointment"), "no-show": t("markNoShow"), "start-visit": t("startVisit") };
  const patientOptions = useMemo(() => {
    const selected = formAppointment?.patient; const results = patients.data?.results ?? [];
    return selected && !results.some((patient) => patient.id === selected.id) ? [selected, ...results] : results;
  }, [formAppointment?.patient, patients.data?.results]);

  const isRescheduleWorkspace = view === "needs-reschedule";
  return <div className="appointment-page"><PageHeader eyebrow={workspace} title={t("calendar")} description={description} actions={permissions.canCreate ? <Button onClick={openCreate}>{t("addAppointment")}</Button> : undefined} />
    {role !== "DOCTOR" ? <nav className="v2-tabs appointment-workspace-tabs" aria-label={t("appointmentWorkspaceTabs")}><NavLink to={{ pathname: appointmentViewPath(role, "day"), search: `?${searchParams.toString()}` }} className={!isRescheduleWorkspace ? "active" : ""}>{t("calendar")}</NavLink><NavLink to={{ pathname: appointmentViewPath(role, "needs-reschedule"), search: `?${searchParams.toString()}` }} className={isRescheduleWorkspace ? "active" : ""}>{t("needsReschedule")}</NavLink></nav> : null}
    <Card>{!isRescheduleWorkspace ? <AppointmentCalendarToolbar role={role} view={view} views={viewsForRole(role)} date={date} canCreate={false} onPrevious={() => shiftPeriod(-1)} onNext={() => shiftPeriod(1)} onToday={() => setCalendarDate(todayInputValue())} onCreate={openCreate} /> : null}<AppointmentFilters date={date} status={status} doctorId={doctorId} doctors={doctors.data ?? []} showDoctorFilter={role !== "DOCTOR"} onDateChange={setCalendarDate} onStatusChange={(value) => setParam("status", value === "ALL" ? "" : value)} onDoctorChange={(value) => setParam("doctor", value)} /></Card>
    <div className={calendarView ? "appointment-calendar-layout" : ""}><Card>{activeQuery.isLoading ? <LoadingState title={t("calendarLoading")} /> : null}{activeQuery.isError ? <ErrorState error={activeQuery.error} onRetry={() => void activeQuery.refetch()} title={t("calendarError")} /> : null}{activeQuery.data ? <><>{activeQuery.isFetching ? <p className="panel-note">{t("refreshingAppointments")}</p> : null}</>{calendarView && rows.length === 0 ? <StatePanel state="empty" title={t("calendarEmpty")} /> : null}{view === "day" ? <AppointmentDayView role={role} appointments={rows} onDetails={openDetails} /> : null}{view === "week" ? <AppointmentWeekView role={role} date={date} appointments={rows} onDetails={openDetails} onSelectDay={setCalendarDate} onOpenDay={openDay} /> : null}{view === "month" ? <AppointmentMonthView date={date} appointments={rows} onDetails={openDetails} onSelectDay={setCalendarDate} onOpenDay={openDay} /> : null}{view === "list" ? <AppointmentTable role={role} appointments={rows} onDetails={openDetails} /> : null}{view === "needs-reschedule" ? <NeedsRescheduleView role={role} appointments={rows} onDetails={openDetails} /> : null}{!calendarView ? <div className="pagination-bar"><span className="bidi-isolate">{appointments.data?.count} {t("records")}</span><div><button className="button secondary" type="button" disabled={!appointments.data?.previous || page <= 1} onClick={() => setParam("page", String(page - 1))}>{t("previous")}</button><span className="bidi-isolate">{t("page")} {page}</span><button className="button secondary" type="button" disabled={!appointments.data?.next} onClick={() => setParam("page", String(page + 1))}>{t("next")}</button></div></div> : null}</> : null}</Card>{calendarView ? <AppointmentCalendarSummary view={view} appointments={rows} /> : null}</div>
    <Modal open={isCreateOpen} title={t("addAppointment")} description={t("chooseAvailableTime")} onClose={() => { setCreateDirty(false); setCreateOpen(false); }} pending={createAppointment.isPending} dirty={createDirty} wide><AppointmentForm mode="create" doctors={doctors.data ?? []} doctorsLoading={doctors.isLoading} doctorsError={doctors.error} onRetryDoctors={() => void doctors.refetch()} patients={patientOptions} patientsLoading={patients.isLoading || patientSearch !== patientSearchDebounced} patientsError={patients.error} onRetryPatients={() => void patients.refetch()} settings={clinicSettings.data} settingsLoading={clinicSettings.isLoading} settingsError={clinicSettings.error} onRetrySettings={() => void clinicSettings.refetch()} initialDate={date} initialDoctorId={Number(doctorId) || undefined} isSubmitting={createAppointment.isPending} error={createAppointment.error} onDirtyChange={setCreateDirty} onPatientSearch={setPatientSearch} onSubmit={submitCreate} /></Modal>
    <Modal open={Boolean(formAppointment)} title={formMode === "reschedule" ? t("rescheduleAppointment") : t("editAppointment")} description={formMode === "reschedule" ? t("chooseAvailableTime") : undefined} onClose={closeForm} pending={updateAppointment.isPending} dirty={formDirty} wide>{formAppointment && formMode ? <AppointmentForm mode={formMode} doctors={doctors.data ?? []} doctorsLoading={doctors.isLoading} doctorsError={doctors.error} onRetryDoctors={() => void doctors.refetch()} patients={patientOptions} patientsLoading={patients.isLoading || patientSearch !== patientSearchDebounced} patientsError={patients.error} onRetryPatients={() => void patients.refetch()} settings={clinicSettings.data} settingsLoading={clinicSettings.isLoading} settingsError={clinicSettings.error} onRetrySettings={() => void clinicSettings.refetch()} appointment={formAppointment} isSubmitting={updateAppointment.isPending} error={updateAppointment.error} onDirtyChange={setFormDirty} onPatientSearch={setPatientSearch} onSubmit={submitUpdate} /> : null}</Modal>
    <AppointmentDetailsModal appointmentId={appointmentId} role={role} onClose={closeDetails} onEdit={openForm} onStatusAction={openStatusAction} />
    <ConfirmDialog open={Boolean(actionAppointment && action)} title={t("confirmAppointmentAction")} description={actionAppointment && action ? `${actionCopy[action]}: ${actionAppointment.patient.full_name}` : undefined} onClose={() => { const current = actionAppointment; setActionAppointment(null); setAction(null); restoreActionDetails(current); }} pending={isActionSubmitting}>{currentMutationError ? <StatePanel state="error" title={t("unableToCompleteAction")} /> : null}<Button variant="secondary" onClick={() => { const current = actionAppointment; setActionAppointment(null); setAction(null); restoreActionDetails(current); }}>{t("keepAppointment")}</Button><Button loading={isActionSubmitting} onClick={() => void confirmStatusAction()}>{t("confirmAction")}</Button></ConfirmDialog>
  </div>;
}
