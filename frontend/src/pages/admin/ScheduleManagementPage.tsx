import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Copy, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { scheduleApi } from "../../api/endpoints/schedule";
import { usersApi } from "../../api/endpoints/users";
import { ApiClientError } from "../../api/errors";
import { Button, ConfirmDialog, Field, FormSection, Modal, PageHeaderV2, SectionHeading, SelectField, StatePanel, StatusBadge, SurfaceCard, useOverlayClose } from "../../components/v2";
import { useAuthStore } from "../../auth/authStore";
import { useFeatureT } from "../../layouts/i18n";
import type { ClinicDefaultShift, ScheduleApplyMode, ShiftImpact, WorkingShift } from "../../types/schedule";
import { getErrorMessage } from "../../utils/apiErrors";
import { formatClock } from "../../utils/dates";

const weekdays = [0, 1, 2, 3, 4, 5, 6];
type ShiftDraft = { name: string; weekday: number; start_time: string; end_time: string };
const blankShift: ShiftDraft = { name: "", weekday: 0, start_time: "09:00", end_time: "13:00" };
const isEmployee = <T extends { role: string }>(person: T): person is T & { role: "DOCTOR" | "STAFF" } => person.role === "DOCTOR" || person.role === "STAFF";

function isImpact(error: unknown): error is ApiClientError { return error instanceof ApiClientError && error.code === "SHIFT_CHANGE_REQUIRES_CONFIRMATION"; }
function isScheduleInvariant(error: unknown): boolean { return error instanceof ApiClientError && error.code === "ACTIVE_PROFESSIONAL_REQUIRES_SCHEDULE"; }
function impactDetails(error: ApiClientError): ShiftImpact { return error.details as unknown as ShiftImpact; }

function ShiftEditor({ initial, onSave, onDirtyChange, onPendingChange }: { initial: ShiftDraft; onSave: (draft: ShiftDraft) => Promise<unknown>; onDirtyChange: (dirty: boolean) => void; onPendingChange: (pending: boolean) => void }) {
  const t = useFeatureT();
  const language = useAuthStore((state) => state.user?.language_preference ?? "EN");
  const [draft, setDraft] = useState(initial);
  const mutation = useMutation({ mutationFn: () => onSave(draft) });
  const close = useOverlayClose();
  const weekday = (day: number) => new Intl.DateTimeFormat(language === "AR" ? "ar" : "en", { weekday: "long" }).format(new Date(Date.UTC(2024, 0, 1 + day)));
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  useEffect(() => onPendingChange(mutation.isPending), [mutation.isPending, onPendingChange]);
  return <form onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }}>
    <FormSection title={t("defaultShift")}>
      <Field label={t("shiftName")} required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
      <SelectField label={t("weekday")} value={draft.weekday} onChange={(event) => setDraft({ ...draft, weekday: Number(event.target.value) })}>{weekdays.map((day) => <option key={day} value={day}>{weekday(day)}</option>)}</SelectField>
      <Field label={t("startTime")} required type="time" value={draft.start_time} onChange={(event) => setDraft({ ...draft, start_time: event.target.value })} />
      <Field label={t("endTime")} required type="time" value={draft.end_time} onChange={(event) => setDraft({ ...draft, end_time: event.target.value })} />
    </FormSection>
    {mutation.error ? <StatePanel state="error" title={t("error")} description={getErrorMessage(mutation.error)} /> : null}
    <div className="v2-sticky-actions"><Button type="button" variant="secondary" onClick={close} disabled={mutation.isPending}>{t("cancel")}</Button><Button type="submit" loading={mutation.isPending}>{t("saveShift")}</Button></div>
  </form>;
}

export function ScheduleManagementPage() {
  const t = useFeatureT();
  const language = useAuthStore((state) => state.user?.language_preference ?? "EN");
  const [params] = useSearchParams();
  const client = useQueryClient();
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [mode, setMode] = useState<ScheduleApplyMode>("MISSING_ONLY");
  const [copySource, setCopySource] = useState<number | null>(null);
  const [editor, setEditor] = useState<{ kind: "default" | "employee"; shift?: ClinicDefaultShift | WorkingShift } | null>(null);
  const [editorDirty, setEditorDirty] = useState(false);
  const [editorPending, setEditorPending] = useState(false);
  const [impact, setImpact] = useState<{ details: ShiftImpact; rerun: () => void } | null>(null);
  const [invariantError, setInvariantError] = useState(false);
  const defaults = useQuery({ queryKey: ["clinic-default-shifts"], queryFn: scheduleApi.defaultShifts });
  const people = useQuery({ queryKey: ["schedule-employees"], queryFn: () => usersApi.list({ page: 1 }) });
  const shifts = useQuery({ queryKey: ["employee-working-shifts", employeeId], queryFn: () => scheduleApi.workingShifts({ employee_id: employeeId ?? undefined }), enabled: employeeId !== null });
  const weekday = (day: number) => new Intl.DateTimeFormat(language === "AR" ? "ar" : "en", { weekday: "long" }).format(new Date(Date.UTC(2024, 0, 1 + day)));
  const employees = useMemo(() => (people.data?.results ?? []).filter(isEmployee), [people.data]);
  useEffect(() => { const requested = Number(params.get("employee")); if (requested && employees.some((person) => person.id === requested)) setEmployeeId(requested); }, [employees, params]);
  const role = (value: "DOCTOR" | "STAFF") => value === "DOCTOR" ? t("doctor") : t("staff");
  const employeeName = (id: number) => employees.find((person) => person.id === id)?.full_name ?? "";
  const invalidate = () => { void client.invalidateQueries({ queryKey: ["clinic-default-shifts"] }); void client.invalidateQueries({ queryKey: ["employee-working-shifts", employeeId] }); void client.invalidateQueries({ queryKey: ["working-shifts"] }); void client.invalidateQueries({ queryKey: ["appointments"] }); void client.invalidateQueries({ queryKey: ["needs-reschedule"] }); void client.invalidateQueries({ queryKey: ["team-members"] }); void client.invalidateQueries({ queryKey: ["doctors"] }); };
  const withImpact = (error: unknown, rerun: () => void) => { if (isImpact(error)) setImpact({ details: impactDetails(error), rerun }); if (isScheduleInvariant(error)) setInvariantError(true); };
  const apply = useMutation({ mutationFn: (confirmed: boolean) => scheduleApi.applyDefault(employeeId!, mode, confirmed), onSuccess: invalidate, onError: (error) => withImpact(error, () => apply.mutate(true)) });
  const copy = useMutation({ mutationFn: (confirmed: boolean) => scheduleApi.copySchedule(copySource!, employeeId!, mode, confirmed), onSuccess: invalidate, onError: (error) => withImpact(error, () => copy.mutate(true)) });
  const toggleDefault = useMutation({ mutationFn: ({ shift, confirmed }: { shift: ClinicDefaultShift; confirmed: boolean }) => scheduleApi.setDefaultShiftActive(shift.id, shift.version, !shift.is_active), onSuccess: invalidate });
  const toggleEmployee = useMutation({ mutationFn: ({ shift, confirmed }: { shift: WorkingShift; confirmed: boolean }) => scheduleApi.setWorkingShiftActive(shift.id, shift.version, !shift.is_active, confirmed), onSuccess: invalidate, onError: (error, input) => withImpact(error, () => toggleEmployee.mutate({ ...input, confirmed: true })) });
  const closeEditor = () => { setEditorDirty(false); setEditorPending(false); setEditor(null); };
  const saveEditor = async (draft: ShiftDraft) => {
    if (!editor) return;
    const version = editor.shift?.version;
    if (editor.kind === "default") {
      if (editor.shift) await scheduleApi.updateDefaultShift(editor.shift.id, { ...draft, version: version! });
      else await scheduleApi.createDefaultShift(draft);
    } else if (editor.shift) await scheduleApi.updateWorkingShift(editor.shift.id, { ...draft, version: version! });
    else await scheduleApi.createWorkingShift({ ...draft, employee_id: employeeId! });
    invalidate(); closeEditor();
  };
  const editorDraft = editor?.shift ? { name: editor.shift.name, weekday: editor.shift.weekday, start_time: editor.shift.start_time, end_time: editor.shift.end_time } : blankShift;
  const defaultRows = defaults.data?.results ?? [];
  const employeeRows = shifts.data?.results ?? [];

  return <div className="admin-page">
    <PageHeaderV2 title={t("schedules")} description={t("scheduleHelp")} />
    {invariantError ? <StatePanel state="error" title={t("cannotRemoveFinalShift")} description={`${t("deactivateProfessionalFirst")} · ${t("addAnotherActiveShift")}`} /> : null}
    <div className="schedule-grid">
      <SurfaceCard major><SectionHeading title={t("clinicDefaults")} description={t("scheduleAdministration")} /><Button onClick={() => setEditor({ kind: "default" })}><Plus size={18} />{t("addShift")}</Button>
        {defaults.isLoading ? <StatePanel state="loading" title={t("loadingSchedules")} /> : defaults.isError ? <StatePanel state="error" title={t("scheduleUnavailable")} description={getErrorMessage(defaults.error)} action={<Button variant="secondary" onClick={() => void defaults.refetch()}>{t("retry")}</Button>} /> : !defaultRows.length ? <StatePanel state="empty" title={t("noDefaults")} /> : <ul className="schedule-list">{defaultRows.map((shift) => <li key={shift.id}><div><strong className="bidi-isolate">{shift.name}</strong><span><bdi>{weekday(shift.weekday)} · {formatClock(shift.start_time)}–{formatClock(shift.end_time)}</bdi></span></div><div className="schedule-actions"><StatusBadge status={shift.is_active ? "ACTIVE" : "INACTIVE"} /><Button compact variant="secondary" onClick={() => setEditor({ kind: "default", shift })}>{t("editShift")}</Button><Button compact variant="secondary" loading={toggleDefault.isPending} onClick={() => toggleDefault.mutate({ shift, confirmed: false })}>{shift.is_active ? t("deactivateShift") : t("activateShift")}</Button></div></li>)}</ul>}
      </SurfaceCard>
      <SurfaceCard major><SectionHeading title={t("employeeSchedule")} /><SelectField label={t("employee")} value={employeeId ?? ""} onChange={(event) => { setEmployeeId(event.target.value ? Number(event.target.value) : null); setCopySource(null); }}><option value="">{t("selectEmployee")}</option>{employees.map((person) => <option key={person.id} value={person.id}>{person.full_name} — {role(person.role)}</option>)}</SelectField>
        {people.isError ? <StatePanel state="error" title={t("scheduleUnavailable")} description={getErrorMessage(people.error)} action={<Button variant="secondary" onClick={() => void people.refetch()}>{t("retry")}</Button>} /> : employeeId === null ? <StatePanel state="empty" title={t("selectEmployee")} /> : <>
          <div className="v2-table-toolbar"><SelectField label={t("mode")} value={mode} onChange={(event) => setMode(event.target.value as ScheduleApplyMode)}><option value="MISSING_ONLY">{t("missingOnly")}</option><option value="REPLACE_ALL">{t("replaceAll")}</option></SelectField><Button variant="secondary" loading={apply.isPending} onClick={() => apply.mutate(false)}>{t("applyDefaults")}</Button></div>
          <div className="v2-table-toolbar"><SelectField label={t("selectScheduleSource")} value={copySource ?? ""} onChange={(event) => setCopySource(event.target.value ? Number(event.target.value) : null)}><option value="">{t("selectScheduleSource")}</option>{employees.filter((person) => person.id !== employeeId).map((person) => <option key={person.id} value={person.id}>{person.full_name} — {role(person.role)}</option>)}</SelectField><Button variant="secondary" disabled={!copySource} loading={copy.isPending} onClick={() => copy.mutate(false)}><Copy size={16} />{t("copySchedule")}</Button></div>
          <Button onClick={() => setEditor({ kind: "employee" })}><Plus size={18} />{t("addShift")}</Button>
          {shifts.isLoading ? <StatePanel state="loading" title={t("loadingSchedules")} /> : shifts.isError ? <StatePanel state="error" title={t("scheduleUnavailable")} description={getErrorMessage(shifts.error)} action={<Button variant="secondary" onClick={() => void shifts.refetch()}>{t("retry")}</Button>} /> : !employeeRows.length ? <StatePanel state="empty" title={t("noEmployeeShifts")} /> : <ul className="schedule-list">{employeeRows.map((shift) => <li key={shift.id}><div><strong className="bidi-isolate">{shift.name}</strong><span><bdi>{weekday(shift.weekday)} · {formatClock(shift.start_time)}–{formatClock(shift.end_time)}</bdi></span></div><div className="schedule-actions"><StatusBadge status={shift.is_active ? "ACTIVE" : "INACTIVE"} /><Button compact variant="secondary" onClick={() => setEditor({ kind: "employee", shift })}>{t("editShift")}</Button><Button compact variant="secondary" loading={toggleEmployee.isPending} onClick={() => toggleEmployee.mutate({ shift, confirmed: false })}>{shift.is_active ? t("deactivateShift") : t("activateShift")}</Button></div></li>)}</ul>}
        </>}
      </SurfaceCard>
    </div>
    <Modal open={Boolean(editor)} title={editor?.shift ? t("editShift") : t("addShift")} onClose={closeEditor} dirty={editorDirty} pending={editorPending}><ShiftEditor key={`${editor?.kind}-${editor?.shift?.id ?? "new"}`} initial={editorDraft} onSave={saveEditor} onDirtyChange={setEditorDirty} onPendingChange={setEditorPending} /></Modal>
    <ConfirmDialog open={Boolean(impact)} title={t("impactTitle")} description={t("impactMessage")} onClose={() => setImpact(null)} pending={apply.isPending || copy.isPending || toggleEmployee.isPending}><p><bdi>{impact?.details.impacted_count ?? 0}</bdi> {t("impactCount")}</p><ul aria-label={t("affectedAppointments")}>{impact?.details.appointments.map((appointment) => <li key={appointment.id}><span className="bidi-isolate">{appointment.patient_name}</span> · <bdi>{new Intl.DateTimeFormat(language === "AR" ? "ar" : "en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(appointment.start_datetime))}</bdi> · {t("needsReschedule")}</li>)}</ul><div className="v2-sticky-actions"><Button variant="secondary" onClick={() => setImpact(null)}>{t("keepSchedule")}</Button><Button loading={apply.isPending || copy.isPending || toggleEmployee.isPending} onClick={() => { const rerun = impact?.rerun; setImpact(null); rerun?.(); }}>{t("confirmChange")}</Button></div></ConfirmDialog>
  </div>;
}
