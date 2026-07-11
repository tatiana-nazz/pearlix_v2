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

export function LeaveManagementPage() {
  const queryClient = useQueryClient();
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");
  const users = useQuery({ queryKey: ["schedule-employees"], queryFn: () => usersApi.list({ page: 1 }) });
  const leave = useQuery({ queryKey: ["availability-exceptions", "admin"], queryFn: () => scheduleApi.availabilityExceptions({ page: 1 }) });
  const employees = useMemo(() => (users.data?.results ?? []).filter((user) => user.role === "DOCTOR" || user.role === "STAFF"), [users.data]);
  const selected = employees.find((user) => user.id === employeeId);
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["availability-exceptions"] });
  const create = useMutation({
    mutationFn: () => scheduleApi.createAvailabilityException({
      doctor_id: selected?.role === "DOCTOR" ? selected.id : null,
      staff_id: selected?.role === "STAFF" ? selected.id : null,
      start_datetime: new Date(start).toISOString(),
      end_datetime: new Date(end).toISOString(),
      type: "UNAVAILABLE",
      reason,
    }),
    onSuccess: () => { setStart(""); setEnd(""); setReason(""); refresh(); },
  });
  const cancel = useMutation({ mutationFn: ({ id, version }: { id: number; version: number }) => scheduleApi.cancelAvailabilityException(id, version), onSuccess: refresh });

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
      {leave.isLoading ? <LoadingState title="Loading leave records..." /> : leave.isError ? <ErrorState error={leave.error} onRetry={() => void leave.refetch()} /> : !leave.data?.results.length ? <EmptyState title="No leave or availability exceptions were returned." /> : <ul className="schedule-list">{leave.data.results.map((item) => <li key={item.id}><div><strong>{item.doctor?.full_name ?? item.staff?.full_name}</strong><span>{formatDateRange(item.start_datetime, item.end_datetime)}</span><span>{displayText(item.reason, "No reason recorded")}</span></div><div><StatusPill status={item.is_cancelled ? "CANCELLED" : item.type} tone={item.is_cancelled ? "default" : "attention"} />{!item.is_cancelled && <button className="button ghost" disabled={cancel.isPending} onClick={() => cancel.mutate({ id: item.id, version: item.version })}>Cancel leave</button>}</div></li>)}</ul>}
    </div>
  );
}
