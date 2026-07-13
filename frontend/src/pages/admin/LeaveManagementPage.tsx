import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";

import { scheduleApi } from "../../api/endpoints/schedule";
import { usersApi } from "../../api/endpoints/users";
import { Button, ConfirmDialog, Field, FormSection, Modal, PageHeaderV2, SectionHeading, SelectField, StatePanel, StatusBadge, SurfaceCard, useOverlayClose } from "../../components/v2";
import { useAuthStore } from "../../auth/authStore";
import { useFeatureT } from "../../layouts/i18n";
import type { AvailabilityException, AvailabilityExceptionPayload, AvailabilityExceptionType } from "../../types/schedule";
import { getErrorMessage } from "../../utils/apiErrors";
import { formatDateRange } from "../../utils/dates";

type LeaveDraft = { employeeId: string; start: string; end: string; type: AvailabilityExceptionType; reason: string };
const emptyLeave: LeaveDraft = { employeeId: "", start: "", end: "", type: "UNAVAILABLE", reason: "" };
const toLocal = (value: string) => value.slice(0, 16);
const isEmployee = <T extends { role: string }>(person: T): person is T & { role: "DOCTOR" | "STAFF" } => person.role === "DOCTOR" || person.role === "STAFF";

function roleLabel(role: "DOCTOR" | "STAFF", t: ReturnType<typeof useFeatureT>) { return role === "DOCTOR" ? t("doctor") : t("staff"); }

function LeaveForm({ leave, employees, onSave, onDirtyChange, onPendingChange }: { leave?: AvailabilityException; employees: Array<{ id: number; full_name: string; role: "DOCTOR" | "STAFF" }>; onSave: (payload: AvailabilityExceptionPayload) => Promise<unknown>; onDirtyChange: (dirty: boolean) => void; onPendingChange: (pending: boolean) => void }) {
  const t = useFeatureT();
  const close = useOverlayClose();
  const initial: LeaveDraft = leave ? { employeeId: String(leave.doctor?.id ?? leave.staff?.id ?? ""), start: toLocal(leave.start_datetime), end: toLocal(leave.end_datetime), type: leave.type, reason: leave.reason } : emptyLeave;
  const [draft, setDraft] = useState(initial);
  const selected = employees.find((employee) => employee.id === Number(draft.employeeId));
  const mutation = useMutation({ mutationFn: () => onSave({ doctor_id: selected?.role === "DOCTOR" ? selected.id : null, staff_id: selected?.role === "STAFF" ? selected.id : null, start_datetime: new Date(draft.start).toISOString(), end_datetime: new Date(draft.end).toISOString(), type: draft.type, reason: draft.reason, ...(leave ? { version: leave.version } : {}) }) });
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  useEffect(() => onPendingChange(mutation.isPending), [mutation.isPending, onPendingChange]);
  const doctor = selected?.role === "DOCTOR" || Boolean(leave?.doctor);
  return <form onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }}>
    <FormSection title={t("leaveAvailability")}>
      <SelectField label={t("employee")} required disabled={Boolean(leave)} value={draft.employeeId} onChange={(event) => setDraft({ ...draft, employeeId: event.target.value })}><option value="">{t("selectEmployee")}</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.full_name} — {roleLabel(employee.role, t)}</option>)}</SelectField>
      <Field label={t("start")} required type="datetime-local" value={draft.start} onChange={(event) => setDraft({ ...draft, start: event.target.value })} />
      <Field label={t("end")} required type="datetime-local" value={draft.end} onChange={(event) => setDraft({ ...draft, end: event.target.value })} />
      <SelectField label={t("type")} value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as AvailabilityExceptionType })}><option value="UNAVAILABLE">{t("unavailable")}</option><option value="AVAILABLE_OVERRIDE">{t("availableOverride")}</option></SelectField>
      <Field label={t("reason")} value={draft.reason} onChange={(event) => setDraft({ ...draft, reason: event.target.value })} />
    </FormSection>
    <p>{doctor ? t("doctorImpact") : t("staffImpact")}</p>
    {mutation.error ? <StatePanel state="error" title={t("error")} description={getErrorMessage(mutation.error)} /> : null}
    <div className="v2-sticky-actions"><Button type="button" variant="secondary" onClick={close} disabled={mutation.isPending}>{t("cancel")}</Button><Button type="submit" loading={mutation.isPending}>{t("saveLeave")}</Button></div>
  </form>;
}

export function LeaveManagementPage() {
  const t = useFeatureT();
  const language = useAuthStore((state) => state.user?.language_preference ?? "EN");
  const { exceptionId } = useParams();
  const navigate = useNavigate();
  const client = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [form, setForm] = useState<AvailabilityException | "new" | null>(null);
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<AvailabilityException | null>(null);
  const people = useQuery({ queryKey: ["schedule-employees"], queryFn: () => usersApi.list({ page: 1 }) });
  const employees = useMemo(() => (people.data?.results ?? []).filter(isEmployee), [people.data]);
  const employeeId = params.get("employee") ?? "";
  const type = params.get("type") ?? "";
  const state = params.get("state") ?? "";
  const startFrom = params.get("start_from") ?? "";
  const endTo = params.get("end_to") ?? "";
  const selectedEmployee = employees.find((employee) => employee.id === Number(employeeId));
  const query = { page: 1, ...(selectedEmployee?.role === "DOCTOR" ? { doctor_id: employeeId } : selectedEmployee?.role === "STAFF" ? { staff_id: employeeId } : {}), ...(type ? { type } : {}), ...(state ? { is_cancelled: state } : {}), ...(startFrom ? { start_from: new Date(startFrom).toISOString() } : {}), ...(endTo ? { end_to: new Date(endTo).toISOString() } : {}) };
  const leave = useQuery({ queryKey: ["availability-exceptions", "admin", query], queryFn: () => scheduleApi.availabilityExceptions(query), enabled: !employeeId || Boolean(selectedEmployee) });
  const detail = useQuery({ queryKey: ["availability-exception", exceptionId], queryFn: () => scheduleApi.availabilityException(Number(exceptionId)), enabled: Boolean(exceptionId) });
  const set = (key: string, value: string) => { const next = new URLSearchParams(params); value ? next.set(key, value) : next.delete(key); setParams(next); };
  const invalidate = () => { void client.invalidateQueries({ queryKey: ["availability-exceptions"] }); void client.invalidateQueries({ queryKey: ["availability-exception", exceptionId] }); void client.invalidateQueries({ queryKey: ["appointments"] }); void client.invalidateQueries({ queryKey: ["needs-reschedule"] }); };
  const createOrUpdate = async (payload: AvailabilityExceptionPayload) => { if (form && form !== "new") { const { version: _version, ...update } = payload; await scheduleApi.updateAvailabilityException(form.id, { ...update, version: form.version }); } else await scheduleApi.createAvailabilityException(payload); invalidate(); setDirty(false); setPending(false); setForm(null); };
  const cancel = useMutation({ mutationFn: (target: AvailabilityException) => scheduleApi.cancelAvailabilityException(target.id, target.version), onSuccess: () => { invalidate(); setCancelTarget(null); } });
  const closeForm = () => { setDirty(false); setPending(false); setForm(null); };
  const record = (item: AvailabilityException) => <li key={item.id}><button type="button" className="schedule-record" onClick={() => navigate(`/admin/leave/${item.id}`)}><strong className="bidi-isolate">{item.doctor?.full_name ?? item.staff?.full_name}</strong><span><bdi>{formatDateRange(item.start_datetime, item.end_datetime)}</bdi></span><span className="bidi-isolate">{item.reason || t("noReason")}</span></button><div className="schedule-actions"><StatusBadge status={item.is_cancelled ? "CANCELLED" : item.type === "UNAVAILABLE" ? "PENDING" : "ACTIVE"} /><Button compact variant="secondary" onClick={() => setForm(item)} disabled={item.is_cancelled}>{t("editLeave")}</Button><Button compact variant="danger" onClick={() => setCancelTarget(item)} disabled={item.is_cancelled}>{t("cancelLeave")}</Button></div></li>;
  if (exceptionId) {
    if (detail.isLoading) return <StatePanel state="loading" title={t("loadingLeave")} />;
    if (detail.isError || !detail.data) return <StatePanel state="notFound" title={t("leaveNotFound")} description={detail.error ? getErrorMessage(detail.error) : undefined} action={<Link className="v2-button secondary" to="/admin/leave">{t("backToLeave")}</Link>} />;
    const item = detail.data;
    return <div className="admin-page"><Link className="inline-back-link" to="/admin/leave">{t("backToLeave")}</Link><PageHeaderV2 title={t("leaveAvailability")} description={item.doctor ? t("doctorImpact") : t("staffImpact")} action={!item.is_cancelled ? <><Button variant="secondary" onClick={() => setForm(item)}>{t("editLeave")}</Button><Button variant="danger" onClick={() => setCancelTarget(item)}>{t("cancelLeave")}</Button></> : undefined} /><SurfaceCard major><SectionHeading title={item.doctor?.full_name ?? item.staff?.full_name ?? t("employee")} /><dl className="detail-grid"><div><dt>{t("start")}</dt><dd><bdi>{formatDateRange(item.start_datetime, item.end_datetime)}</bdi></dd></div><div><dt>{t("status")}</dt><dd><StatusBadge status={item.is_cancelled ? "CANCELLED" : item.type === "UNAVAILABLE" ? "PENDING" : "ACTIVE"} /></dd></div><div className="detail-wide"><dt>{t("reason")}</dt><dd className="bidi-isolate">{item.reason || t("noReason")}</dd></div></dl></SurfaceCard><LeaveOverlays form={form} employees={employees} onSave={createOrUpdate} dirty={dirty} pending={pending} onDirtyChange={setDirty} onPendingChange={setPending} onClose={closeForm} cancelTarget={cancelTarget} onCancelTarget={setCancelTarget} cancel={cancel} t={t} /></div>;
  }
  return <div className="admin-page"><PageHeaderV2 title={t("leaveAvailability")} description={t("leaveHelp")} action={<Button onClick={() => setForm("new")}><Plus size={18} />{t("createLeave")}</Button>} /><SurfaceCard major><SectionHeading title={t("leaveRecords")} /><div className="v2-table-toolbar"><SelectField label={t("employee")} value={employeeId} onChange={(event) => set("employee", event.target.value)}><option value="">{t("allEmployees")}</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.full_name} — {roleLabel(employee.role, t)}</option>)}</SelectField><SelectField label={t("type")} value={type} onChange={(event) => set("type", event.target.value)}><option value="">{t("all")}</option><option value="UNAVAILABLE">{t("unavailable")}</option><option value="AVAILABLE_OVERRIDE">{t("availableOverride")}</option></SelectField><SelectField label={t("status")} value={state} onChange={(event) => set("state", event.target.value)}><option value="">{t("allLeaveStates")}</option><option value="false">{t("activeLeave")}</option><option value="true">{t("cancelled")}</option></SelectField><Field label={t("dateFrom")} type="datetime-local" value={startFrom} onChange={(event) => set("start_from", event.target.value)} /><Field label={t("dateTo")} type="datetime-local" value={endTo} onChange={(event) => set("end_to", event.target.value)} /></div>{leave.isLoading ? <StatePanel state="loading" title={t("loadingLeave")} /> : leave.isError ? <StatePanel state="error" title={t("leaveUnavailable")} description={getErrorMessage(leave.error)} action={<Button variant="secondary" onClick={() => void leave.refetch()}>{t("retry")}</Button>} /> : !leave.data?.results.length ? <StatePanel state="empty" title={t("noLeave")} /> : <ul className="schedule-list">{leave.data.results.map(record)}</ul>}</SurfaceCard><LeaveOverlays form={form} employees={employees} onSave={createOrUpdate} dirty={dirty} pending={pending} onDirtyChange={setDirty} onPendingChange={setPending} onClose={closeForm} cancelTarget={cancelTarget} onCancelTarget={setCancelTarget} cancel={cancel} t={t} /></div>;
}

function LeaveOverlays({ form, employees, onSave, dirty, pending, onDirtyChange, onPendingChange, onClose, cancelTarget, onCancelTarget, cancel, t }: { form: AvailabilityException | "new" | null; employees: Array<{ id: number; full_name: string; role: "DOCTOR" | "STAFF" }>; onSave: (payload: AvailabilityExceptionPayload) => Promise<unknown>; dirty: boolean; pending: boolean; onDirtyChange: (value: boolean) => void; onPendingChange: (value: boolean) => void; onClose: () => void; cancelTarget: AvailabilityException | null; onCancelTarget: (value: AvailabilityException | null) => void; cancel: ReturnType<typeof useMutation<unknown, unknown, AvailabilityException>>; t: ReturnType<typeof useFeatureT> }) {
  return <><Modal open={Boolean(form)} title={form === "new" ? t("createLeave") : t("editLeave")} onClose={onClose} dirty={dirty} pending={pending}><LeaveForm key={form === "new" ? "new" : form?.id} leave={form && form !== "new" ? form : undefined} employees={employees} onSave={onSave} onDirtyChange={onDirtyChange} onPendingChange={onPendingChange} /></Modal><ConfirmDialog open={Boolean(cancelTarget)} title={t("cancelLeave")} description={t("cancelLeaveImpact")} onClose={() => onCancelTarget(null)} pending={cancel.isPending}>{cancelTarget?.doctor ? <p>{t("doctorImpact")}</p> : <p>{t("staffImpact")}</p>}{cancel.error ? <StatePanel state="error" title={t("error")} description={getErrorMessage(cancel.error)} /> : null}<div className="v2-sticky-actions"><Button variant="secondary" onClick={() => onCancelTarget(null)}>{t("cancel")}</Button><Button variant="danger" loading={cancel.isPending} onClick={() => cancelTarget && cancel.mutate(cancelTarget)}>{t("cancelLeave")}</Button></div></ConfirmDialog></>;
}
