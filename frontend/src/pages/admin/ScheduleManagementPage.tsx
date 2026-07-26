import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { scheduleApi } from "../../api/endpoints/schedule";
import { usersApi } from "../../api/endpoints/users";
import { ApiClientError } from "../../api/errors";
import { Card } from "../../components/Card";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { LoadingState } from "../../components/LoadingState";
import { PageHeader } from "../../components/PageHeader";
import { StatusPill } from "../../components/StatusPill";
import type { ClinicDefaultShift, ScheduleApplyMode, ShiftImpact, WorkingShift } from "../../types/schedule";
import { formatClock, formatWeekday } from "../../utils/dates";

const weekdays = [0, 1, 2, 3, 4, 5, 6];
const initialShift = { name: "", weekday: 0, start_time: "09:00", end_time: "13:00" };

function isImpact(error: unknown) { return error instanceof ApiClientError && error.code === "SHIFT_CHANGE_REQUIRES_CONFIRMATION"; }

export function ScheduleManagementPage() {
  const queryClient = useQueryClient();
  const [defaultForm, setDefaultForm] = useState(initialShift);
  const [selectedEmployee, setSelectedEmployee] = useState<number | null>(null);
  const [employeeForm, setEmployeeForm] = useState(initialShift);
  const [mode, setMode] = useState<ScheduleApplyMode>("MISSING_ONLY");
  const [copySource, setCopySource] = useState<number | null>(null);
  const [impact, setImpact] = useState<{ action: () => void; details: ShiftImpact } | null>(null);
  const [selectedDefaultShift, setSelectedDefaultShift] = useState<ClinicDefaultShift | null>(null);
  const [selectedEmployeeShift, setSelectedEmployeeShift] = useState<WorkingShift | null>(null);
  const defaults = useQuery({ queryKey: ["clinic-default-shifts"], queryFn: scheduleApi.defaultShifts });
  const employees = useQuery({ queryKey: ["schedule-employees"], queryFn: () => usersApi.list({ page: 1 }) });
  const selectedShifts = useQuery({ queryKey: ["employee-working-shifts", selectedEmployee], queryFn: () => scheduleApi.workingShifts({ employee_id: selectedEmployee ?? undefined }), enabled: selectedEmployee !== null });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["clinic-default-shifts"] });
  const refreshEmployee = () => { refresh(); void queryClient.invalidateQueries({ queryKey: ["employee-working-shifts", selectedEmployee] }); void queryClient.invalidateQueries({ queryKey: ["working-shifts"] }); };
  const createDefault = useMutation({ mutationFn: () => scheduleApi.createDefaultShift(defaultForm), onSuccess: () => { setDefaultForm(initialShift); refresh(); } });
  const addShift = useMutation({ mutationFn: () => scheduleApi.createWorkingShift({ ...employeeForm, employee_id: selectedEmployee! }), onSuccess: refreshEmployee });
  const impactDetails = (error: ApiClientError) => error.details as unknown as ShiftImpact;
  const applyDefaults = useMutation({ mutationFn: (confirmed: boolean) => scheduleApi.applyDefault(selectedEmployee!, mode, confirmed), onSuccess: refreshEmployee, onError: (error) => { if (isImpact(error)) setImpact({ action: () => applyDefaults.mutate(true), details: impactDetails(error as ApiClientError) }); } });
  const copySchedule = useMutation({ mutationFn: (confirmed: boolean) => scheduleApi.copySchedule(copySource!, selectedEmployee!, mode, confirmed), onSuccess: refreshEmployee, onError: (error) => { if (isImpact(error)) setImpact({ action: () => copySchedule.mutate(true), details: impactDetails(error as ApiClientError) }); } });
  const editDefault = async (shift: ClinicDefaultShift) => {
    const name = window.prompt("Shift name", shift.name);
    if (name && name !== shift.name) { await scheduleApi.updateDefaultShift(shift.id, { name, version: shift.version }); refresh(); }
  };
  const editEmployeeShift = async (shift: WorkingShift) => {
    const name = window.prompt("Shift name", shift.name);
    if (name && name !== shift.name) { await scheduleApi.updateWorkingShift(shift.id, { name, version: shift.version }); refreshEmployee(); }
  };
  const employeeOptions = useMemo(
    () => (employees.data?.results ?? []).filter((employee) => employee.role === "DOCTOR" || employee.role === "STAFF"),
    [employees.data],
  );
  const defaultsList = defaults.data?.results ?? [];
  return <div className="schedule-page">
    <PageHeader eyebrow="Scheduling administration" title="Schedules and leave" description="Clinic defaults are templates. They do not modify employee schedules until an Admin explicitly applies or copies them." />
    {impact && <div className="conflict-banner" role="alert"><strong>{impact.details.impacted_count} future appointment(s) need rescheduling.</strong><span>Confirming will move each affected appointment to Needs Reschedule.</span><ul>{impact.details.appointments.map((item) => <li key={item.id}>{item.patient_name} | {new Date(item.start_datetime).toLocaleString()} | {item.status}</li>)}</ul><button className="button secondary" onClick={() => setImpact(null)}>Cancel</button><button className="button primary" onClick={() => { const action = impact.action; setImpact(null); action(); }}>Confirm shift change</button></div>}
    <div className="schedule-grid">
      <Card><h2>Clinic default schedule</h2><p className="panel-note">Templates remain independent after they are applied.</p>
        <form className="compact-form" onSubmit={(event) => { event.preventDefault(); createDefault.mutate(); }}>
          <label>Name<input value={defaultForm.name} onChange={(event) => setDefaultForm({ ...defaultForm, name: event.target.value })} required /></label>
          <label>Weekday<select value={defaultForm.weekday} onChange={(event) => setDefaultForm({ ...defaultForm, weekday: Number(event.target.value) })}>{weekdays.map((day) => <option key={day} value={day}>{formatWeekday(day)}</option>)}</select></label>
          <label>Start<input type="time" value={defaultForm.start_time} onChange={(event) => setDefaultForm({ ...defaultForm, start_time: event.target.value })} required /></label>
          <label>End<input type="time" value={defaultForm.end_time} onChange={(event) => setDefaultForm({ ...defaultForm, end_time: event.target.value })} required /></label>
          <button className="button primary" disabled={createDefault.isPending}>Add default shift</button>
        </form>
        {defaults.isLoading ? <LoadingState title="Loading defaults..." /> : defaults.isError ? <ErrorState error={defaults.error} onRetry={() => void defaults.refetch()} /> : defaultsList.length ? <ul className="schedule-list">{defaultsList.map((shift: ClinicDefaultShift) => <li key={shift.id} className="clickable-row" tabIndex={0} onClick={() => setSelectedDefaultShift(shift)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedDefaultShift(shift); } }}><div><strong>{shift.name}</strong><span>{formatWeekday(shift.weekday)} | {formatClock(shift.start_time)} - {formatClock(shift.end_time)}</span></div><StatusPill status={shift.is_active ? "ACTIVE" : "INACTIVE"} /></li>)}</ul> : <EmptyState title="No clinic default shifts have been created." />}
      </Card>
      <Card><h2>Employee schedules</h2><label>Employee<select value={selectedEmployee ?? ""} onChange={(event) => setSelectedEmployee(event.target.value ? Number(event.target.value) : null)}><option value="">Select an employee</option>{employeeOptions.map((employee) => <option key={employee.id} value={employee.id}>{employee.full_name} ({employee.role})</option>)}</select></label>
        {selectedEmployee ? <><div className="schedule-actions"><button className="button secondary" onClick={() => applyDefaults.mutate(false)}>Apply defaults: {mode === "MISSING_ONLY" ? "missing only" : "replace all"}</button><button className="button ghost" onClick={() => setMode(mode === "MISSING_ONLY" ? "REPLACE_ALL" : "MISSING_ONLY")}>Switch mode</button></div>
        <label>Copy source<select value={copySource ?? ""} onChange={(event) => setCopySource(event.target.value ? Number(event.target.value) : null)}><option value="">Choose source employee</option>{employeeOptions.filter((employee) => employee.id !== selectedEmployee).map((employee) => <option key={employee.id} value={employee.id}>{employee.full_name} ({employee.role})</option>)}</select></label><button className="button secondary" disabled={!copySource} onClick={() => copySchedule.mutate(false)}>Copy schedule</button>
        <form className="compact-form" onSubmit={(event) => { event.preventDefault(); addShift.mutate(); }}><h3>Add shift</h3><label>Name<input value={employeeForm.name} onChange={(event) => setEmployeeForm({ ...employeeForm, name: event.target.value })} required /></label><label>Weekday<select value={employeeForm.weekday} onChange={(event) => setEmployeeForm({ ...employeeForm, weekday: Number(event.target.value) })}>{weekdays.map((day) => <option key={day} value={day}>{formatWeekday(day)}</option>)}</select></label><label>Start<input type="time" value={employeeForm.start_time} onChange={(event) => setEmployeeForm({ ...employeeForm, start_time: event.target.value })} required /></label><label>End<input type="time" value={employeeForm.end_time} onChange={(event) => setEmployeeForm({ ...employeeForm, end_time: event.target.value })} required /></label><button className="button primary" disabled={addShift.isPending}>Add shift</button></form>
        {selectedShifts.isLoading ? <LoadingState title="Loading employee shifts..." /> : <ul className="schedule-list">{(selectedShifts.data?.results ?? []).map((shift: WorkingShift) => <li key={shift.id} className="clickable-row" tabIndex={0} onClick={() => setSelectedEmployeeShift(shift)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedEmployeeShift(shift); } }}><div><strong>{shift.name}</strong><span>{formatWeekday(shift.weekday)} | {formatClock(shift.start_time)} - {formatClock(shift.end_time)}</span></div><StatusPill status={shift.is_active ? "ACTIVE" : "INACTIVE"} /></li>)}</ul>}</> : <EmptyState title="Select an employee to view and manage the weekly schedule." />}
      </Card>
    </div>
    {selectedDefaultShift ? <div className="dialog-backdrop" role="presentation"><section className="dialog-panel" role="dialog" aria-modal="true" aria-label="Default shift details"><h3>{selectedDefaultShift.name}</h3><p>{formatWeekday(selectedDefaultShift.weekday)} | {formatClock(selectedDefaultShift.start_time)} - {formatClock(selectedDefaultShift.end_time)}</p><StatusPill status={selectedDefaultShift.is_active ? "ACTIVE" : "INACTIVE"} /><div className="form-actions"><button className="button secondary" onClick={() => void editDefault(selectedDefaultShift)}>Edit</button><button className="button secondary" onClick={() => void scheduleApi.setDefaultShiftActive(selectedDefaultShift.id, selectedDefaultShift.version, !selectedDefaultShift.is_active).then(() => { refresh(); setSelectedDefaultShift(null); })}>{selectedDefaultShift.is_active ? "Deactivate" : "Activate"}</button><button className="button ghost" onClick={() => setSelectedDefaultShift(null)}>Close</button></div></section></div> : null}
    {selectedEmployeeShift ? <div className="dialog-backdrop" role="presentation"><section className="dialog-panel" role="dialog" aria-modal="true" aria-label="Employee shift details"><h3>{selectedEmployeeShift.name}</h3><p>{formatWeekday(selectedEmployeeShift.weekday)} | {formatClock(selectedEmployeeShift.start_time)} - {formatClock(selectedEmployeeShift.end_time)}</p><StatusPill status={selectedEmployeeShift.is_active ? "ACTIVE" : "INACTIVE"} /><div className="form-actions"><button className="button secondary" onClick={() => void editEmployeeShift(selectedEmployeeShift)}>Edit</button><button className="button secondary" onClick={() => void scheduleApi.setWorkingShiftActive(selectedEmployeeShift.id, selectedEmployeeShift.version, !selectedEmployeeShift.is_active).then(() => { refreshEmployee(); setSelectedEmployeeShift(null); })}>{selectedEmployeeShift.is_active ? "Deactivate" : "Activate"}</button><button className="button ghost" onClick={() => setSelectedEmployeeShift(null)}>Close</button></div></section></div> : null}
  </div>;
}
