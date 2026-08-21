import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { scheduleApi } from "../../api/endpoints/schedule";
import { usersApi } from "../../api/endpoints/users";
import { Card } from "../../components/Card";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { LoadingState } from "../../components/LoadingState";
import { PageHeader } from "../../components/PageHeader";
import { StatusPill } from "../../components/StatusPill";
import { formatDateRange } from "../../utils/dates";
import { displayText } from "../../utils/formatters";
import type { AvailabilityException } from "../../types/schedule";

export function LeaveManagementPage() {
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
  const selected = employees.find((user) => user.id === employeeId);
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["availability-exceptions"] });
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
    const nextReason = window.prompt("Leave reason", currentReason);
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
      <PageHeader eyebrow="Scheduling administration" title="Leave and availability" description="Leave is cancelled or voided, never deleted. Staff leave does not affect patient appointments." />
      <Card>
        <form className="compact-form" onSubmit={(event) => { event.preventDefault(); create.mutate(); }}>
          <label>Employee<select required value={employeeId ?? ""} onChange={(event) => setEmployeeId(event.target.value ? Number(event.target.value) : null)}><option value="">Select Doctor or Staff</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.full_name} ({employee.role})</option>)}</select></label>
          <label>Start<input required type="datetime-local" value={start} onChange={(event) => setStart(event.target.value)} /></label>
          <label>End<input required type="datetime-local" value={end} onChange={(event) => setEnd(event.target.value)} /></label>
          <label>Reason<input value={reason} onChange={(event) => setReason(event.target.value)} /></label>
          <button className="button primary" disabled={create.isPending || !selected}>Create unavailable period</button>
        </form>
      </Card>
      {create.error || cancel.error || actionError ? <ErrorState title="Unable to update leave" error={create.error || cancel.error || actionError} onRetry={() => { create.reset(); cancel.reset(); setActionError(null); }} /> : null}
      {leave.isLoading ? <LoadingState title="Loading leave records..." /> : leave.isError ? <ErrorState error={leave.error} onRetry={() => void leave.refetch()} /> : !leave.data?.results.length ? <EmptyState title="No leave or availability exceptions were returned." /> : <ul className="schedule-list">{leave.data.results.map((item) => <li key={item.id} className="clickable-row" tabIndex={0} onClick={() => setSelectedLeave(item)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedLeave(item); } }}><div><strong>{item.doctor?.full_name ?? item.staff?.full_name}</strong><span>{formatDateRange(item.start_datetime, item.end_datetime)}</span><span>{displayText(item.reason, "No reason recorded")}</span></div><StatusPill status={item.is_cancelled ? "CANCELLED" : item.type} /></li>)}</ul>}
      {selectedLeave ? <div className="dialog-backdrop" role="presentation"><section className="dialog-panel" role="dialog" aria-modal="true" aria-label="Leave details"><h3>{selectedLeave.doctor?.full_name ?? selectedLeave.staff?.full_name}</h3><p>{formatDateRange(selectedLeave.start_datetime, selectedLeave.end_datetime)}</p><p>{displayText(selectedLeave.reason, "No reason recorded")}</p><StatusPill status={selectedLeave.is_cancelled ? "CANCELLED" : selectedLeave.type} /><div className="form-actions">{!selectedLeave.is_cancelled ? <><button className="button secondary" onClick={() => void editReason(selectedLeave.id, selectedLeave.version, selectedLeave.reason)}>Edit</button><button className="button danger" disabled={cancel.isPending} onClick={() => cancel.mutate({ id: selectedLeave.id, version: selectedLeave.version }, { onSuccess: () => setSelectedLeave(null) })}>Cancel leave</button></> : null}<button className="button ghost" onClick={() => setSelectedLeave(null)}>Close</button></div></section></div> : null}
    </div>
  );
}
