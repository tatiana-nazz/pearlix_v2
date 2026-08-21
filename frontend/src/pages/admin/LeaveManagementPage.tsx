import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { scheduleApi } from "../../api/endpoints/schedule";
import { usersApi } from "../../api/endpoints/users";
import { BackLink } from "../../components/BackLink";
import { Card } from "../../components/Card";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { LoadingState } from "../../components/LoadingState";
import { PageHeader } from "../../components/PageHeader";
import { StatusPill } from "../../components/StatusPill";
import { formatDateRange } from "../../utils/dates";
import { displayText } from "../../utils/formatters";
import type { AvailabilityException } from "../../types/schedule";
import { Modal } from "../../components/v2";
import { useUnsavedChanges } from "../../hooks/useUnsavedChanges";
import { useAuthStore } from "../../auth/authStore";

const leaveCopy = {
  EN: { eyebrow:"Scheduling administration", title:"Leave and availability", description:"Leave is cancelled or voided, never deleted. Staff leave does not affect patient appointments.", employee:"Employee", select:"Select Doctor or Staff", start:"Start", end:"End", reason:"Reason", create:"Create unavailable period", error:"Unable to update leave", loading:"Loading leave records...", empty:"No leave or availability exceptions were returned.", noReason:"No reason recorded", details:"Leave details", edit:"Edit", cancelLeave:"Cancel leave", close:"Close", notFound:"Leave record not found", prompt:"Leave reason", discard:"You have an unfinished leave entry. Leave this page and discard it?", backToLeave:"Back to Leave" },
  AR: { eyebrow:"إدارة الجدولة", title:"الإجازات والتوفر", description:"تُلغى الإجازة ولا تُحذف. إجازة الموظف لا تؤثر في مواعيد المرضى.", employee:"الموظف", select:"اختر طبيباً أو موظفاً", start:"البداية", end:"النهاية", reason:"السبب", create:"إنشاء فترة عدم توفر", error:"تعذر تحديث الإجازة", loading:"جارٍ تحميل سجلات الإجازة...", empty:"لا توجد إجازات أو استثناءات توفر.", noReason:"لم يُسجل سبب", details:"تفاصيل الإجازة", edit:"تعديل", cancelLeave:"إلغاء الإجازة", close:"إغلاق", notFound:"سجل الإجازة غير موجود", prompt:"سبب الإجازة", discard:"لديك إدخال إجازة غير مكتمل. هل تريد مغادرة الصفحة وتجاهله؟", backToLeave:"العودة إلى الإجازات" },
} as const;

export function LeaveManagementPage() {
  const language = useAuthStore((state) => state.user?.language_preference ?? "EN");
  const c = leaveCopy[language];
  const navigate = useNavigate();
  const exceptionId = Number(useParams<{ exceptionId?: string }>().exceptionId);
  const queryClient = useQueryClient();
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");
  const [selectedLeave, setSelectedLeave] = useState<AvailabilityException | null>(null);
  const [actionError, setActionError] = useState<unknown>(null);
  const users = useQuery({ queryKey: ["schedule-employees"], queryFn: usersApi.listScheduleEmployees });
  const leave = useQuery({ queryKey: ["availability-exceptions", "admin"], queryFn: () => scheduleApi.allAvailabilityExceptions() });
  const employees = useMemo(() => (users.data?.results ?? []).filter((user) => user.role === "DOCTOR" || user.role === "STAFF"), [users.data]);
  const dirty = Boolean(employeeId || start || end || reason);
  useUnsavedChanges(dirty, c.discard);
  useEffect(() => {
    if (!exceptionId || !leave.data) return;
    setSelectedLeave(leave.data.results.find((item) => item.id === exceptionId) ?? null);
  }, [exceptionId, leave.data]);
  const selected = employees.find((user) => user.id === employeeId);
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["availability-exceptions"] });
  const closeDetails = () => { setSelectedLeave(null); if (exceptionId) navigate("/admin/leave", { replace: true }); };
  const create = useMutation({
    mutationFn: () => scheduleApi.createAvailabilityException({
      doctor_id: selected?.role === "DOCTOR" ? selected.id : null,
      staff_id: selected?.role === "STAFF" ? selected.id : null,
      // A datetime-local input is clinic wall time. Send it without browser
      // timezone conversion; the backend interprets it in ClinicSettings.timezone.
      start_datetime: `${start}:00`,
      end_datetime: `${end}:00`,
      type: "UNAVAILABLE",
      reason,
    }),
    onSuccess: () => { setStart(""); setEnd(""); setReason(""); refresh(); },
  });
  const cancel = useMutation({ mutationFn: ({ id, version }: { id: number; version: number }) => scheduleApi.cancelAvailabilityException(id, version), onSuccess: refresh });
  const editReason = async (id: number, version: number, currentReason: string) => {
    const nextReason = window.prompt(c.prompt, currentReason);
    if (nextReason !== null && nextReason !== currentReason) {
      try {
        setActionError(null);
        await scheduleApi.updateAvailabilityException(id, { reason: nextReason, version });
        refresh();
      } catch (error) {
        setActionError(error);
      }
    }
  };

  return (
    <div className="schedule-page">
      <PageHeader eyebrow={c.eyebrow} title={c.title} description={c.description} />
      <Card>
        <form className="compact-form" onSubmit={(event) => { event.preventDefault(); create.mutate(); }}>
          <label>{c.employee}<select required value={employeeId ?? ""} onChange={(event) => setEmployeeId(event.target.value ? Number(event.target.value) : null)}><option value="">{c.select}</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.full_name} ({employee.role})</option>)}</select></label>
          <label>{c.start}<input required type="datetime-local" value={start} onChange={(event) => setStart(event.target.value)} /></label>
          <label>{c.end}<input required type="datetime-local" value={end} onChange={(event) => setEnd(event.target.value)} /></label>
          <label>{c.reason}<input value={reason} onChange={(event) => setReason(event.target.value)} /></label>
          <button className="button primary" disabled={create.isPending || !selected}>{c.create}</button>
        </form>
      </Card>
      {create.error || cancel.error || actionError ? <ErrorState title={c.error} error={create.error || cancel.error || actionError} onRetry={() => { create.reset(); cancel.reset(); setActionError(null); }} /> : null}
      {leave.isLoading ? <LoadingState title={c.loading} /> : leave.isError ? <ErrorState error={leave.error} onRetry={() => void leave.refetch()} /> : !leave.data?.results.length ? <EmptyState title={c.empty} /> : <ul className="schedule-list">{leave.data.results.map((item) => <li key={item.id} className="clickable-row" tabIndex={0} onClick={() => setSelectedLeave(item)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedLeave(item); } }}><div><strong>{item.doctor?.full_name ?? item.staff?.full_name}</strong><span>{formatDateRange(item.start_datetime, item.end_datetime)}</span><span>{displayText(item.reason, c.noReason)}</span></div><StatusPill status={item.is_cancelled ? "CANCELLED" : item.type} /></li>)}</ul>}
      {exceptionId && leave.data && !selectedLeave ? <ErrorState title={c.notFound} error={null} /> : null}
      {selectedLeave ? <Modal open title={c.details} onClose={closeDetails} pending={cancel.isPending}><BackLink to="/admin/leave" onClick={() => setSelectedLeave(null)}>{c.backToLeave}</BackLink><h3>{selectedLeave.doctor?.full_name ?? selectedLeave.staff?.full_name}</h3><p>{formatDateRange(selectedLeave.start_datetime, selectedLeave.end_datetime)}</p><p>{displayText(selectedLeave.reason, c.noReason)}</p><StatusPill status={selectedLeave.is_cancelled ? "CANCELLED" : selectedLeave.type} /><div className="form-actions">{!selectedLeave.is_cancelled ? <><button className="button secondary" onClick={() => void editReason(selectedLeave.id, selectedLeave.version, selectedLeave.reason)}>{c.edit}</button><button className="button danger" disabled={cancel.isPending} onClick={() => cancel.mutate({ id: selectedLeave.id, version: selectedLeave.version }, { onSuccess: closeDetails })}>{c.cancelLeave}</button></> : null}<button className="button ghost" onClick={closeDetails}>{c.close}</button></div></Modal> : null}
    </div>
  );
}
