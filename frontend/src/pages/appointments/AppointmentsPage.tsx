import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { Card } from "../../components/Card";
import { ErrorState } from "../../components/ErrorState";
import { LoadingState } from "../../components/LoadingState";
import { PageHeader } from "../../components/PageHeader";
import { Button, ConfirmDialog, Modal, StatePanel, StatusBadge } from "../../components/v2";
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
import { useCancelAppointment, useCheckInAppointment, useCreateAppointment, useNoShowAppointment, useStartAppointmentVisit, useUpdateAppointment } from "../../features/appointments/hooks/useAppointmentMutations";
import { useAppointmentRange, useAppointments } from "../../features/appointments/hooks/useAppointments";
import { useDoctors } from "../../features/appointments/hooks/useDoctors";
import { usePatients } from "../../features/patients/hooks/usePatients";
import { addDays, addMonths, todayInputValue } from "../../features/appointments/utils/appointmentDates";
import { buildAppointmentFilters } from "../../features/appointments/utils/appointmentFilters";
import { appointmentViewPath, getAppointmentPermissions } from "../../features/appointments/utils/appointmentPermissions";
import type { AppointmentListItem, AppointmentViewMode, CreateAppointmentPayload, UpdateAppointmentPayload } from "../../types/appointments";
import type { UserRole } from "../../types/auth";
import { formatDateTime } from "../../utils/dates";

interface AppointmentsPageProps { role: UserRole; view: AppointmentViewMode; }
type StatusAction = "check-in" | "cancel" | "no-show" | "start-visit";
type FormMode = "edit" | "reschedule" | null;

function viewsForRole(role: UserRole): AppointmentViewMode[] { return role === "DOCTOR" ? ["day", "week", "list", "needs-reschedule"] : ["day", "week", "month", "list", "needs-reschedule"]; }

export function AppointmentsPage({ role, view }: AppointmentsPageProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [formAppointment, setFormAppointment] = useState<AppointmentListItem | null>(null);
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [createDirty, setCreateDirty] = useState(false);
  const [formDirty, setFormDirty] = useState(false);
  const [patientSearch, setPatientSearch] = useState("");
  const [detailsAppointment, setDetailsAppointment] = useState<AppointmentListItem | null>(null);
  const [actionAppointment, setActionAppointment] = useState<AppointmentListItem | null>(null);
  const [action, setAction] = useState<StatusAction | null>(null);
  const navigate = useNavigate(); const t = useFeatureT();
  const date = searchParams.get("date") || todayInputValue(); const status = (searchParams.get("status") || "ALL") as AppointmentStatusFilter; const doctorId = searchParams.get("doctor") || ""; const page = Number(searchParams.get("page") || "1");
  const calendarView = view === "day" || view === "week" || view === "month";
  const filters = useMemo(() => buildAppointmentFilters({ role, view, date, status, page: Number.isFinite(page) && page > 0 ? page : 1, doctorId: Number(doctorId) || undefined }), [date, doctorId, page, role, status, view]);
  const rangeFilters = useMemo(() => buildAppointmentFilters({ role, view, date, status, doctorId: Number(doctorId) || undefined }), [date, doctorId, role, status, view]);
  const appointments = useAppointments(filters, !calendarView); const rangeAppointments = useAppointmentRange(rangeFilters, calendarView); const doctors = useDoctors(); const patients = usePatients({ page: 1, search: patientSearch || undefined, is_archived: false });
  const createAppointment = useCreateAppointment(); const updateAppointment = useUpdateAppointment(formAppointment?.id ?? 0); const checkIn = useCheckInAppointment(); const cancel = useCancelAppointment(); const noShow = useNoShowAppointment(); const startVisit = useStartAppointmentVisit(); const permissions = getAppointmentPermissions(role);
  function setParam(key: string, value: string) { const next = new URLSearchParams(searchParams); if (value) next.set(key, value); else next.delete(key); next.set("page", "1"); setSearchParams(next); }
  function setCalendarDate(value: string) { setParam("date", value); }
  function shiftPeriod(direction: -1 | 1) { if (!calendarView) return; setCalendarDate(view === "day" ? addDays(date, direction) : view === "week" ? addDays(date, direction * 7) : addMonths(date, direction)); }
  function openDay(value: string) { const next = new URLSearchParams(searchParams); next.set("date", value); next.set("page", "1"); navigate({ pathname: appointmentViewPath(role, "day"), search: `?${next.toString()}` }); }
  function openCreate() { setPatientSearch(""); setCreateDirty(false); setCreateOpen(true); }
  function openForm(appointment: AppointmentListItem, mode: Exclude<FormMode, null>) { setPatientSearch(""); setFormDirty(false); setFormAppointment(appointment); setFormMode(mode); }
  function closeForm() { setFormDirty(false); setFormAppointment(null); setFormMode(null); }
  async function submitCreate(payload: CreateAppointmentPayload | UpdateAppointmentPayload) { await createAppointment.mutateAsync(payload as CreateAppointmentPayload); setCreateDirty(false); setCreateOpen(false); }
  async function submitUpdate(payload: CreateAppointmentPayload | UpdateAppointmentPayload) { if (!formAppointment) return; await updateAppointment.mutateAsync(payload as UpdateAppointmentPayload); closeForm(); }
  function openStatusAction(appointment: AppointmentListItem, nextAction: StatusAction) { setActionAppointment(appointment); setAction(nextAction); checkIn.reset(); cancel.reset(); noShow.reset(); startVisit.reset(); }
  async function confirmStatusAction() { if (!actionAppointment || !action) return; if (action === "check-in") await checkIn.mutateAsync(actionAppointment.id); if (action === "cancel") await cancel.mutateAsync(actionAppointment.id); if (action === "no-show") await noShow.mutateAsync(actionAppointment.id); if (action === "start-visit") { await startVisit.mutateAsync(actionAppointment.id); setActionAppointment(null); setAction(null); navigate("/doctor/visits/active"); return; } setActionAppointment(null); setAction(null); }
  const rows = calendarView ? rangeAppointments.data ?? [] : appointments.data?.results ?? []; const activeQuery = calendarView ? rangeAppointments : appointments; const currentMutationError = checkIn.error ?? cancel.error ?? noShow.error ?? startVisit.error; const isActionSubmitting = checkIn.isPending || cancel.isPending || noShow.isPending || startVisit.isPending;
  const workspace = role === "STAFF" ? t("staffWorkspace") : role === "DOCTOR" ? t("doctorWorkspace") : t("adminWorkspace");
  const description = role === "STAFF" ? t("appointmentWorkspaceStaff") : role === "DOCTOR" ? t("appointmentWorkspaceDoctor") : t("appointmentWorkspaceAdmin");
  const viewTitle: Record<AppointmentViewMode, string> = { day: t("dayAppointments"), week: t("weekAppointments"), month: t("monthAppointments"), list: t("appointmentList"), "needs-reschedule": t("needsReschedule") };
  const actionCopy: Record<StatusAction, string> = { "check-in": t("checkIn"), cancel: t("cancelAppointment"), "no-show": t("markNoShow"), "start-visit": t("startVisit") };
  const patientOptions = useMemo(() => {
    const selected = formAppointment?.patient; const results = patients.data?.results ?? [];
    return selected && !results.some((patient) => patient.id === selected.id) ? [selected, ...results] : results;
  }, [formAppointment?.patient, patients.data?.results]);

  return <div className="appointment-page"><PageHeader eyebrow={workspace} title={viewTitle[view]} description={description} />
    <Card><AppointmentCalendarToolbar role={role} view={view} views={viewsForRole(role)} date={date} canCreate={permissions.canCreate} onPrevious={() => shiftPeriod(-1)} onNext={() => shiftPeriod(1)} onToday={() => setCalendarDate(todayInputValue())} onCreate={openCreate} /><AppointmentFilters date={date} status={status} doctorId={doctorId} doctors={doctors.data ?? []} showDoctorFilter={role !== "DOCTOR"} onDateChange={setCalendarDate} onStatusChange={(value) => setParam("status", value === "ALL" ? "" : value)} onDoctorChange={(value) => setParam("doctor", value)} /></Card>
    <div className={calendarView ? "appointment-calendar-layout" : ""}><Card>{activeQuery.isLoading ? <LoadingState title={t("calendarLoading")} /> : null}{activeQuery.isError ? <ErrorState error={activeQuery.error} onRetry={() => void activeQuery.refetch()} title={t("calendarError")} /> : null}{activeQuery.data ? <><>{activeQuery.isFetching ? <p className="panel-note">{t("refreshingAppointments")}</p> : null}</>{calendarView && rows.length === 0 ? <StatePanel state="empty" title={t("calendarEmpty")} /> : null}{view === "day" ? <AppointmentDayView role={role} appointments={rows} onEdit={(item) => openForm(item, "edit")} onReschedule={(item) => openForm(item, "reschedule")} onDetails={setDetailsAppointment} onStatusAction={openStatusAction} /> : null}{view === "week" ? <AppointmentWeekView role={role} date={date} appointments={rows} onDetails={setDetailsAppointment} onSelectDay={setCalendarDate} onOpenDay={openDay} /> : null}{view === "month" ? <AppointmentMonthView date={date} appointments={rows} onDetails={setDetailsAppointment} onSelectDay={setCalendarDate} onOpenDay={openDay} /> : null}{view === "list" ? <AppointmentTable role={role} appointments={rows} onEdit={(item) => openForm(item, "edit")} onReschedule={(item) => openForm(item, "reschedule")} onDetails={setDetailsAppointment} onStatusAction={openStatusAction} /> : null}{view === "needs-reschedule" ? <NeedsRescheduleView role={role} appointments={rows} onEdit={(item) => openForm(item, "edit")} onReschedule={(item) => openForm(item, "reschedule")} onDetails={setDetailsAppointment} /> : null}{!calendarView ? <div className="pagination-bar"><span className="bidi-isolate">{appointments.data?.count} {t("records")}</span><div><button className="button secondary" type="button" disabled={!appointments.data?.previous || page <= 1} onClick={() => setParam("page", String(page - 1))}>{t("previous")}</button><span className="bidi-isolate">{t("page")} {page}</span><button className="button secondary" type="button" disabled={!appointments.data?.next} onClick={() => setParam("page", String(page + 1))}>{t("next")}</button></div></div> : null}</> : null}</Card>{calendarView ? <AppointmentCalendarSummary view={view} appointments={rows} /> : null}</div>
    <Modal open={isCreateOpen} title={t("addAppointment")} description={t("chooseAvailableTime")} onClose={() => { setCreateDirty(false); setCreateOpen(false); }} pending={createAppointment.isPending} dirty={createDirty} wide><AppointmentForm mode="create" doctors={doctors.data ?? []} patients={patientOptions} initialDate={date} initialDoctorId={Number(doctorId) || undefined} isSubmitting={createAppointment.isPending} error={createAppointment.error} onDirtyChange={setCreateDirty} onPatientSearch={setPatientSearch} onSubmit={submitCreate} /></Modal>
    <Modal open={Boolean(formAppointment)} title={formMode === "reschedule" ? t("rescheduleAppointment") : t("editAppointment")} description={formMode === "reschedule" ? t("chooseAvailableTime") : undefined} onClose={closeForm} pending={updateAppointment.isPending} dirty={formDirty} wide>{formAppointment && formMode ? <AppointmentForm mode={formMode} doctors={doctors.data ?? []} patients={patientOptions} appointment={formAppointment} isSubmitting={updateAppointment.isPending} error={updateAppointment.error} onDirtyChange={setFormDirty} onPatientSearch={setPatientSearch} onSubmit={submitUpdate} /> : null}</Modal>
    <Modal open={Boolean(detailsAppointment)} title={t("appointmentDetails")} onClose={() => setDetailsAppointment(null)} wide>{detailsAppointment ? <dl className="detail-grid appointment-details"><div><dt>{t("patient")}</dt><dd className="bidi-isolate">{detailsAppointment.patient.full_name}</dd></div><div><dt>{t("doctor")}</dt><dd className="bidi-isolate">{detailsAppointment.doctor.full_name}</dd></div><div><dt>{t("status")}</dt><dd><StatusBadge status={detailsAppointment.status} /></dd></div><div><dt>{t("date")}</dt><dd className="bidi-isolate">{formatDateTime(detailsAppointment.start_datetime)}</dd></div><div><dt>{t("duration")}</dt><dd className="bidi-isolate">{detailsAppointment.duration_minutes} {t("minutes")}</dd></div><div><dt>{t("reason")}</dt><dd>{detailsAppointment.reason || t("notRecorded")}</dd></div><div><dt>{t("previousStatus")}</dt><dd>{detailsAppointment.reschedule_previous_status ? <StatusBadge status={detailsAppointment.reschedule_previous_status} /> : t("notRecorded")}</dd></div><div><dt>{t("rescheduleSource")}</dt><dd>{detailsAppointment.reschedule_source_label || t("notRecorded")}</dd></div><div><dt>{t("created")}</dt><dd className="bidi-isolate">{formatDateTime(detailsAppointment.created_at)}</dd></div><div><dt>{t("updated")}</dt><dd className="bidi-isolate">{formatDateTime(detailsAppointment.updated_at)}</dd></div></dl> : null}</Modal>
    <ConfirmDialog open={Boolean(actionAppointment && action)} title={t("confirmAppointmentAction")} description={actionAppointment && action ? `${actionCopy[action]}: ${actionAppointment.patient.full_name}` : undefined} onClose={() => { setActionAppointment(null); setAction(null); }} pending={isActionSubmitting}>{currentMutationError ? <StatePanel state="error" title={t("unableToCompleteAction")} description={String(currentMutationError)} /> : null}<Button variant="secondary" onClick={() => { setActionAppointment(null); setAction(null); }}>{t("keepAppointment")}</Button><Button loading={isActionSubmitting} onClick={() => void confirmStatusAction()}>{t("confirmAction")}</Button></ConfirmDialog>
  </div>;
}
