import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { clinicApi, clinicSettingsQueryKey } from "../../api/endpoints/clinic";
import { scheduleApi } from "../../api/endpoints/schedule";
import { usersApi } from "../../api/endpoints/users";
import { ApiClientError } from "../../api/errors";
import { Card } from "../../components/Card";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { LoadingState } from "../../components/LoadingState";
import { PageHeader } from "../../components/PageHeader";
import { StatusPill } from "../../components/StatusPill";
import { Modal } from "../../components/v2";
import { useUnsavedChanges } from "../../hooks/useUnsavedChanges";
import { useAuthStore } from "../../auth/authStore";
import type { ClinicDefaultShift, ScheduleApplyMode, ShiftImpact, WorkingShift } from "../../types/schedule";
import { formatClock, formatWeekday } from "../../utils/dates";

const weekdays = [0, 1, 2, 3, 4, 5, 6];
const initialShift = { name: "", weekday: 0, start_time: "09:00", end_time: "13:00" };

const scheduleCopy = {
  EN: { eyebrow:"Scheduling administration", title:"Schedules and leave", description:"Clinic defaults are templates. They do not modify employee schedules until an Admin explicitly applies or copies them.", error:"Unable to update schedule", future:(count:number)=>`${count} future appointment(s) need rescheduling.`, impact:"Confirming will move each affected appointment to Needs Reschedule.", cancel:"Cancel", confirm:"Confirm shift change", defaults:"Clinic default schedule", defaultsHelp:"Templates remain independent after they are applied.", name:"Name", weekday:"Weekday", start:"Start", end:"End", addDefault:"Add default shift", loadingDefaults:"Loading defaults...", noDefaults:"No clinic default shifts have been created.", employees:"Employee schedules", employee:"Employee", selectEmployee:"Select an employee", apply:"Apply defaults", missing:"missing only", replace:"replace all", switchMode:"Switch mode", copySource:"Copy source", chooseSource:"Choose source employee", copy:"Copy schedule", addShift:"Add shift", loadingShifts:"Loading employee shifts...", selectHelp:"Select an employee to view and manage the weekly schedule.", clinicClosed:"Clinic closed · shift stored", defaultDetails:"Default shift details", employeeDetails:"Employee shift details", edit:"Edit", deactivate:"Deactivate", activate:"Activate", close:"Close", discard:"You have an unfinished schedule entry. Leave this page and discard it?" },
  AR: { eyebrow:"إدارة الجدولة", title:"الجداول والإجازات", description:"جداول العيادة الافتراضية قوالب مستقلة ولا تغيّر جداول الموظفين حتى يطبقها المدير أو ينسخها صراحةً.", error:"تعذر تحديث الجدول", future:(count:number)=>`${count} موعد مستقبلي يحتاج إلى إعادة جدولة.`, impact:"سيؤدي التأكيد إلى نقل كل موعد متأثر إلى حالة تحتاج إعادة جدولة.", cancel:"إلغاء", confirm:"تأكيد تغيير المناوبة", defaults:"جدول العيادة الافتراضي", defaultsHelp:"تبقى القوالب مستقلة بعد تطبيقها.", name:"الاسم", weekday:"يوم الأسبوع", start:"البداية", end:"النهاية", addDefault:"إضافة مناوبة افتراضية", loadingDefaults:"جارٍ تحميل القوالب...", noDefaults:"لا توجد مناوبات افتراضية للعيادة.", employees:"جداول الموظفين", employee:"الموظف", selectEmployee:"اختر موظفاً", apply:"تطبيق القوالب", missing:"الناقص فقط", replace:"استبدال الكل", switchMode:"تبديل الوضع", copySource:"مصدر النسخ", chooseSource:"اختر الموظف المصدر", copy:"نسخ الجدول", addShift:"إضافة مناوبة", loadingShifts:"جارٍ تحميل مناوبات الموظف...", selectHelp:"اختر موظفاً لعرض جدوله الأسبوعي وإدارته.", clinicClosed:"العيادة مغلقة · المناوبة محفوظة", defaultDetails:"تفاصيل المناوبة الافتراضية", employeeDetails:"تفاصيل مناوبة الموظف", edit:"تعديل", deactivate:"تعطيل", activate:"تفعيل", close:"إغلاق", discard:"لديك إدخال جدول غير مكتمل. هل تريد مغادرة الصفحة وتجاهله؟" },
} as const;

function isImpact(error: unknown) { return error instanceof ApiClientError && error.code === "SHIFT_CHANGE_REQUIRES_CONFIRMATION"; }

export function ScheduleManagementPage() {
  const language = useAuthStore((state) => state.user?.language_preference ?? "EN");
  const c = scheduleCopy[language];
  const queryClient = useQueryClient();
  const [defaultForm, setDefaultForm] = useState(initialShift);
  const [selectedEmployee, setSelectedEmployee] = useState<number | null>(null);
  const [employeeForm, setEmployeeForm] = useState(initialShift);
  const [mode, setMode] = useState<ScheduleApplyMode>("MISSING_ONLY");
  const [copySource, setCopySource] = useState<number | null>(null);
  const [impact, setImpact] = useState<{ action: () => void; details: ShiftImpact } | null>(null);
  const [selectedDefaultShift, setSelectedDefaultShift] = useState<ClinicDefaultShift | null>(null);
  const [selectedEmployeeShift, setSelectedEmployeeShift] = useState<WorkingShift | null>(null);
  const [actionError, setActionError] = useState<unknown>(null);
  const defaults = useQuery({ queryKey: ["clinic-default-shifts"], queryFn: scheduleApi.defaultShifts });
  const clinicSettings = useQuery({ queryKey: clinicSettingsQueryKey, queryFn: clinicApi.getSettings, staleTime: 300_000 });
  const employees = useQuery({ queryKey: ["schedule-employees"], queryFn: usersApi.listScheduleEmployees });
  const selectedShifts = useQuery({ queryKey: ["employee-working-shifts", selectedEmployee], queryFn: () => scheduleApi.workingShifts({ employee_id: selectedEmployee ?? undefined }), enabled: selectedEmployee !== null });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["clinic-default-shifts"] });
  const refreshEmployee = () => { refresh(); void queryClient.invalidateQueries({ queryKey: ["employee-working-shifts", selectedEmployee] }); void queryClient.invalidateQueries({ queryKey: ["working-shifts"] }); };
  const dirty = JSON.stringify(defaultForm) !== JSON.stringify(initialShift) || JSON.stringify(employeeForm) !== JSON.stringify(initialShift);
  useUnsavedChanges(dirty, c.discard);
  const createDefault = useMutation({ mutationFn: () => scheduleApi.createDefaultShift(defaultForm), onSuccess: () => { setDefaultForm(initialShift); refresh(); } });
  const addShift = useMutation({ mutationFn: () => scheduleApi.createWorkingShift({ ...employeeForm, employee_id: selectedEmployee! }), onSuccess: () => { setEmployeeForm(initialShift); refreshEmployee(); } });
  const impactDetails = (error: ApiClientError) => error.details as unknown as ShiftImpact;
  const applyDefaults = useMutation({ mutationFn: (confirmed: boolean) => scheduleApi.applyDefault(selectedEmployee!, mode, confirmed), onSuccess: refreshEmployee, onError: (error) => { if (isImpact(error)) setImpact({ action: () => applyDefaults.mutate(true), details: impactDetails(error as ApiClientError) }); } });
  const copySchedule = useMutation({ mutationFn: (confirmed: boolean) => scheduleApi.copySchedule(copySource!, selectedEmployee!, mode, confirmed), onSuccess: refreshEmployee, onError: (error) => { if (isImpact(error)) setImpact({ action: () => copySchedule.mutate(true), details: impactDetails(error as ApiClientError) }); } });
  const editDefault = async (shift: ClinicDefaultShift) => {
    const name = window.prompt(c.name, shift.name);
    if (name && name !== shift.name) { try { setActionError(null); await scheduleApi.updateDefaultShift(shift.id, { name, version: shift.version }); refresh(); } catch (error) { setActionError(error); } }
  };
  const editEmployeeShift = async (shift: WorkingShift) => {
    const name = window.prompt(c.name, shift.name);
    if (name && name !== shift.name) { try { setActionError(null); await scheduleApi.updateWorkingShift(shift.id, { name, version: shift.version }); refreshEmployee(); } catch (error) { setActionError(error); } }
  };
  const employeeOptions = useMemo(
    () => (employees.data?.results ?? []).filter((employee) => employee.role === "DOCTOR" || employee.role === "STAFF"),
    [employees.data],
  );
  const defaultsList = defaults.data?.results ?? [];
  const isClinicClosed = (weekday: number) => clinicSettings.data?.weekly_closed_days.some((day) => day === weekday) ?? false;
  const clinicClosedNote = (weekday: number) => isClinicClosed(weekday) ? <strong className="schedule-closed-note">{c.clinicClosed}</strong> : null;
  return <div className="schedule-page">
    <PageHeader eyebrow={c.eyebrow} title={c.title} description={c.description} />
    {createDefault.error || addShift.error || (applyDefaults.error && !isImpact(applyDefaults.error)) || (copySchedule.error && !isImpact(copySchedule.error)) || actionError ? <ErrorState title={c.error} error={createDefault.error || addShift.error || applyDefaults.error || copySchedule.error || actionError} onRetry={() => { createDefault.reset(); addShift.reset(); applyDefaults.reset(); copySchedule.reset(); setActionError(null); }} /> : null}
    {impact && <div className="conflict-banner" role="alert"><strong>{c.future(impact.details.impacted_count)}</strong><span>{c.impact}</span><ul>{impact.details.appointments.map((item) => <li key={item.id}>{item.patient_name} | {new Date(item.start_datetime).toLocaleString(language === "AR" ? "ar" : "en")} | {item.status}</li>)}</ul><button className="button secondary" onClick={() => setImpact(null)}>{c.cancel}</button><button className="button primary" onClick={() => { const action = impact.action; setImpact(null); action(); }}>{c.confirm}</button></div>}
    <div className="schedule-grid">
      <Card><h2>{c.defaults}</h2><p className="panel-note">{c.defaultsHelp}</p>
        <form className="compact-form" onSubmit={(event) => { event.preventDefault(); createDefault.mutate(); }}>
          <label>{c.name}<input value={defaultForm.name} onChange={(event) => setDefaultForm({ ...defaultForm, name: event.target.value })} required /></label>
          <label>{c.weekday}<select value={defaultForm.weekday} onChange={(event) => setDefaultForm({ ...defaultForm, weekday: Number(event.target.value) })}>{weekdays.map((day) => <option key={day} value={day}>{formatWeekday(day, language)}</option>)}</select></label>
          <label>{c.start}<input type="time" value={defaultForm.start_time} onChange={(event) => setDefaultForm({ ...defaultForm, start_time: event.target.value })} required /></label>
          <label>{c.end}<input type="time" value={defaultForm.end_time} onChange={(event) => setDefaultForm({ ...defaultForm, end_time: event.target.value })} required /></label>
          <button className="button primary" disabled={createDefault.isPending}>{c.addDefault}</button>
        </form>
        {defaults.isLoading ? <LoadingState title={c.loadingDefaults} /> : defaults.isError ? <ErrorState error={defaults.error} onRetry={() => void defaults.refetch()} /> : defaultsList.length ? <ul className="schedule-list">{defaultsList.map((shift: ClinicDefaultShift) => <li key={shift.id} className="clickable-row" tabIndex={0} onClick={() => setSelectedDefaultShift(shift)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedDefaultShift(shift); } }}><div><strong>{shift.name}</strong><span>{formatWeekday(shift.weekday, language)} | {formatClock(shift.start_time)} - {formatClock(shift.end_time)}</span>{clinicClosedNote(shift.weekday)}</div><StatusPill status={isClinicClosed(shift.weekday) ? "CLINIC_CLOSED" : shift.is_active ? "ACTIVE" : "INACTIVE"} /></li>)}</ul> : <EmptyState title={c.noDefaults} />}
      </Card>
      <Card><h2>{c.employees}</h2><label>{c.employee}<select value={selectedEmployee ?? ""} onChange={(event) => setSelectedEmployee(event.target.value ? Number(event.target.value) : null)}><option value="">{c.selectEmployee}</option>{employeeOptions.map((employee) => <option key={employee.id} value={employee.id}>{employee.full_name} ({employee.role})</option>)}</select></label>
        {selectedEmployee ? <><div className="schedule-actions"><button className="button secondary" onClick={() => applyDefaults.mutate(false)}>{c.apply}: {mode === "MISSING_ONLY" ? c.missing : c.replace}</button><button className="button ghost" onClick={() => setMode(mode === "MISSING_ONLY" ? "REPLACE_ALL" : "MISSING_ONLY")}>{c.switchMode}</button></div>
        <label>{c.copySource}<select value={copySource ?? ""} onChange={(event) => setCopySource(event.target.value ? Number(event.target.value) : null)}><option value="">{c.chooseSource}</option>{employeeOptions.filter((employee) => employee.id !== selectedEmployee).map((employee) => <option key={employee.id} value={employee.id}>{employee.full_name} ({employee.role})</option>)}</select></label><button className="button secondary" disabled={!copySource} onClick={() => copySchedule.mutate(false)}>{c.copy}</button>
        <form className="compact-form" onSubmit={(event) => { event.preventDefault(); addShift.mutate(); }}><h3>{c.addShift}</h3><label>{c.name}<input value={employeeForm.name} onChange={(event) => setEmployeeForm({ ...employeeForm, name: event.target.value })} required /></label><label>{c.weekday}<select value={employeeForm.weekday} onChange={(event) => setEmployeeForm({ ...employeeForm, weekday: Number(event.target.value) })}>{weekdays.map((day) => <option key={day} value={day}>{formatWeekday(day, language)}</option>)}</select></label><label>{c.start}<input type="time" value={employeeForm.start_time} onChange={(event) => setEmployeeForm({ ...employeeForm, start_time: event.target.value })} required /></label><label>{c.end}<input type="time" value={employeeForm.end_time} onChange={(event) => setEmployeeForm({ ...employeeForm, end_time: event.target.value })} required /></label><button className="button primary" disabled={addShift.isPending}>{c.addShift}</button></form>
        {selectedShifts.isLoading ? <LoadingState title={c.loadingShifts} /> : selectedShifts.isError ? <ErrorState error={selectedShifts.error} onRetry={() => void selectedShifts.refetch()} /> : <ul className="schedule-list">{(selectedShifts.data?.results ?? []).map((shift: WorkingShift) => <li key={shift.id} className="clickable-row" tabIndex={0} onClick={() => setSelectedEmployeeShift(shift)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedEmployeeShift(shift); } }}><div><strong>{shift.name}</strong><span>{formatWeekday(shift.weekday, language)} | {formatClock(shift.start_time)} - {formatClock(shift.end_time)}</span>{clinicClosedNote(shift.weekday)}</div><StatusPill status={isClinicClosed(shift.weekday) ? "CLINIC_CLOSED" : shift.is_active ? "ACTIVE" : "INACTIVE"} /></li>)}</ul>}</> : <EmptyState title={c.selectHelp} />}
      </Card>
    </div>
    {selectedDefaultShift ? <Modal open title={c.defaultDetails} onClose={() => setSelectedDefaultShift(null)}><h3>{selectedDefaultShift.name}</h3><p>{formatWeekday(selectedDefaultShift.weekday, language)} | {formatClock(selectedDefaultShift.start_time)} - {formatClock(selectedDefaultShift.end_time)}</p>{clinicClosedNote(selectedDefaultShift.weekday)}<StatusPill status={isClinicClosed(selectedDefaultShift.weekday) ? "CLINIC_CLOSED" : selectedDefaultShift.is_active ? "ACTIVE" : "INACTIVE"} /><div className="form-actions"><button className="button secondary" onClick={() => void editDefault(selectedDefaultShift)}>{c.edit}</button><button className="button secondary" onClick={() => { setActionError(null); void scheduleApi.setDefaultShiftActive(selectedDefaultShift.id, selectedDefaultShift.version, !selectedDefaultShift.is_active).then(() => { refresh(); setSelectedDefaultShift(null); }).catch(setActionError); }}>{selectedDefaultShift.is_active ? c.deactivate : c.activate}</button><button className="button ghost" onClick={() => setSelectedDefaultShift(null)}>{c.close}</button></div></Modal> : null}
    {selectedEmployeeShift ? <Modal open title={c.employeeDetails} onClose={() => setSelectedEmployeeShift(null)}><h3>{selectedEmployeeShift.name}</h3><p>{formatWeekday(selectedEmployeeShift.weekday, language)} | {formatClock(selectedEmployeeShift.start_time)} - {formatClock(selectedEmployeeShift.end_time)}</p>{clinicClosedNote(selectedEmployeeShift.weekday)}<StatusPill status={isClinicClosed(selectedEmployeeShift.weekday) ? "CLINIC_CLOSED" : selectedEmployeeShift.is_active ? "ACTIVE" : "INACTIVE"} /><div className="form-actions"><button className="button secondary" onClick={() => void editEmployeeShift(selectedEmployeeShift)}>{c.edit}</button><button className="button secondary" onClick={() => { setActionError(null); void scheduleApi.setWorkingShiftActive(selectedEmployeeShift.id, selectedEmployeeShift.version, !selectedEmployeeShift.is_active).then(() => { refreshEmployee(); setSelectedEmployeeShift(null); }).catch(setActionError); }}>{selectedEmployeeShift.is_active ? c.deactivate : c.activate}</button><button className="button ghost" onClick={() => setSelectedEmployeeShift(null)}>{c.close}</button></div></Modal> : null}
  </div>;
}
