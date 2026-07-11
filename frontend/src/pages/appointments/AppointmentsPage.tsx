import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { Card } from "../../components/Card";
import { ErrorState } from "../../components/ErrorState";
import { LoadingState } from "../../components/LoadingState";
import { PageHeader } from "../../components/PageHeader";
import { AppointmentConfirmDialog } from "../../features/appointments/components/AppointmentConfirmDialog";
import { AppointmentDayView } from "../../features/appointments/components/AppointmentDayView";
import { AppointmentDetailsDialog } from "../../features/appointments/components/AppointmentDetailsDialog";
import { AppointmentFilters, type AppointmentStatusFilter } from "../../features/appointments/components/AppointmentFilters";
import { AppointmentForm } from "../../features/appointments/components/AppointmentForm";
import { AppointmentMonthView } from "../../features/appointments/components/AppointmentMonthView";
import { AppointmentTable } from "../../features/appointments/components/AppointmentTable";
import { AppointmentViewTabs } from "../../features/appointments/components/AppointmentViewTabs";
import { AppointmentWeekView } from "../../features/appointments/components/AppointmentWeekView";
import { NeedsRescheduleView } from "../../features/appointments/components/NeedsRescheduleView";
import {
  useCancelAppointment,
  useCheckInAppointment,
  useCreateAppointment,
  useNoShowAppointment,
  useStartAppointmentVisit,
  useUpdateAppointment,
} from "../../features/appointments/hooks/useAppointmentMutations";
import { useAppointments } from "../../features/appointments/hooks/useAppointments";
import { useDoctors } from "../../features/appointments/hooks/useDoctors";
import { todayInputValue, viewLabel } from "../../features/appointments/utils/appointmentDates";
import { buildAppointmentFilters } from "../../features/appointments/utils/appointmentFilters";
import { getAppointmentPermissions } from "../../features/appointments/utils/appointmentPermissions";
import type { AppointmentListItem, AppointmentViewMode, CreateAppointmentPayload, UpdateAppointmentPayload } from "../../types/appointments";
import type { UserRole } from "../../types/auth";

interface AppointmentsPageProps {
  role: UserRole;
  view: AppointmentViewMode;
}

type StatusAction = "check-in" | "cancel" | "no-show" | "start-visit";

function viewsForRole(role: UserRole): AppointmentViewMode[] {
  if (role === "DOCTOR") return ["day", "week", "list", "needs-reschedule"];
  return ["day", "week", "month", "list", "needs-reschedule"];
}

function descriptionForRole(role: UserRole) {
  if (role === "STAFF") return "Create, edit, reschedule, check in, cancel, and no-show appointments through backend scheduling actions.";
  if (role === "DOCTOR") return "Review your own schedule and start checked-in visits when backend permissions allow.";
  return "Read-only clinic appointment visibility for supervision and schedule review.";
}

export function AppointmentsPage({ role, view }: AppointmentsPageProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [formAppointment, setFormAppointment] = useState<AppointmentListItem | null>(null);
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [detailsAppointment, setDetailsAppointment] = useState<AppointmentListItem | null>(null);
  const [actionAppointment, setActionAppointment] = useState<AppointmentListItem | null>(null);
  const [action, setAction] = useState<StatusAction | null>(null);
  const navigate = useNavigate();

  const date = searchParams.get("date") || todayInputValue();
  const status = (searchParams.get("status") || "ALL") as AppointmentStatusFilter;
  const doctorId = searchParams.get("doctor") || "";
  const page = Number(searchParams.get("page") || "1");
  const filters = useMemo(
    () =>
      buildAppointmentFilters({
        role,
        view,
        date,
        status,
        page: Number.isFinite(page) && page > 0 ? page : 1,
        doctorId: Number(doctorId) || undefined,
      }),
    [date, doctorId, page, role, status, view],
  );
  const appointments = useAppointments(filters);
  const doctors = useDoctors();
  const createAppointment = useCreateAppointment();
  const updateAppointment = useUpdateAppointment(formAppointment?.id ?? 0);
  const checkIn = useCheckInAppointment();
  const cancel = useCancelAppointment();
  const noShow = useNoShowAppointment();
  const startVisit = useStartAppointmentVisit();
  const permissions = getAppointmentPermissions(role);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    next.set("page", "1");
    setSearchParams(next);
  }

  async function submitCreate(payload: CreateAppointmentPayload | UpdateAppointmentPayload) {
    await createAppointment.mutateAsync(payload as CreateAppointmentPayload);
    setCreateOpen(false);
  }

  async function submitUpdate(payload: CreateAppointmentPayload | UpdateAppointmentPayload) {
    if (!formAppointment) return;
    await updateAppointment.mutateAsync(payload as UpdateAppointmentPayload);
    setFormAppointment(null);
  }

  function openStatusAction(appointment: AppointmentListItem, nextAction: StatusAction) {
    setActionAppointment(appointment);
    setAction(nextAction);
    checkIn.reset();
    cancel.reset();
    noShow.reset();
    startVisit.reset();
  }

  async function confirmStatusAction() {
    if (!actionAppointment || !action) return;
    if (action === "check-in") await checkIn.mutateAsync(actionAppointment.id);
    if (action === "cancel") await cancel.mutateAsync(actionAppointment.id);
    if (action === "no-show") await noShow.mutateAsync(actionAppointment.id);
    if (action === "start-visit") {
      const visit = await startVisit.mutateAsync(actionAppointment.id);
      setActionAppointment(null);
      setAction(null);
      navigate(`/doctor/visits/${visit.id}`);
      return;
    }
    setActionAppointment(null);
    setAction(null);
  }

  const rows = appointments.data?.results ?? [];
  const currentMutationError = checkIn.error ?? cancel.error ?? noShow.error ?? startVisit.error;
  const isActionSubmitting = checkIn.isPending || cancel.isPending || noShow.isPending || startVisit.isPending;

  return (
    <div className="appointment-page">
      <PageHeader
        eyebrow={`${role.toLowerCase()} workspace`}
        title={`${viewLabel(view)} Appointments`}
        description={descriptionForRole(role)}
        actions={
          permissions.canCreate ? (
            <button className="button primary" type="button" onClick={() => setCreateOpen(true)}>
              Add Appointment
            </button>
          ) : null
        }
      />

      <Card>
        <AppointmentViewTabs role={role} views={viewsForRole(role)} />
        <AppointmentFilters
          date={date}
          status={status}
          doctorId={doctorId}
          doctors={doctors.data ?? []}
          showDoctorFilter={role !== "DOCTOR"}
          onDateChange={(value) => setParam("date", value)}
          onStatusChange={(value) => setParam("status", value === "ALL" ? "" : value)}
          onDoctorChange={(value) => setParam("doctor", value)}
        />
      </Card>

      <Card>
        {appointments.isLoading ? <LoadingState title="Loading appointments..." /> : null}
        {appointments.isError ? (
          <ErrorState error={appointments.error} onRetry={() => void appointments.refetch()} title="Unable to load appointments" />
        ) : null}
        {appointments.data ? (
          <>
            {appointments.isFetching ? <p className="panel-note">Refreshing appointment results...</p> : null}
            {view === "day" ? (
              <AppointmentDayView role={role} appointments={rows} onEdit={setFormAppointment} onDetails={setDetailsAppointment} onStatusAction={openStatusAction} />
            ) : null}
            {view === "week" ? <AppointmentWeekView role={role} date={date} appointments={rows} onDetails={setDetailsAppointment} /> : null}
            {view === "month" ? <AppointmentMonthView date={date} appointments={rows} onDetails={setDetailsAppointment} /> : null}
            {view === "list" ? (
              <AppointmentTable role={role} appointments={rows} onEdit={setFormAppointment} onDetails={setDetailsAppointment} onStatusAction={openStatusAction} />
            ) : null}
            {view === "needs-reschedule" ? (
              <NeedsRescheduleView role={role} appointments={rows} onEdit={setFormAppointment} onDetails={setDetailsAppointment} />
            ) : null}
            <div className="pagination-bar">
              <span>{appointments.data.count} records</span>
              <div>
                <button className="button secondary" type="button" disabled={!appointments.data.previous || page <= 1} onClick={() => setParam("page", String(page - 1))}>
                  Previous
                </button>
                <span>Page {page}</span>
                <button className="button secondary" type="button" disabled={!appointments.data.next} onClick={() => setParam("page", String(page + 1))}>
                  Next
                </button>
              </div>
            </div>
          </>
        ) : null}
      </Card>

      {isCreateOpen ? (
        <div className="dialog-backdrop" role="presentation">
          <section className="dialog-panel wide" role="dialog" aria-modal="true" aria-labelledby="new-appointment-title">
            <h3 id="new-appointment-title">Add Appointment</h3>
            <AppointmentForm
              mode="create"
              doctors={doctors.data ?? []}
              initialDate={date}
              initialDoctorId={Number(doctorId) || undefined}
              isSubmitting={createAppointment.isPending}
              error={createAppointment.error}
              onCancel={() => setCreateOpen(false)}
              onSubmit={submitCreate}
            />
          </section>
        </div>
      ) : null}

      {formAppointment ? (
        <div className="dialog-backdrop" role="presentation">
          <section className="dialog-panel wide" role="dialog" aria-modal="true" aria-labelledby="edit-appointment-title">
            <h3 id="edit-appointment-title">Edit Appointment</h3>
            <AppointmentForm
              mode={formAppointment.status === "NEEDS_RESCHEDULE" ? "reschedule" : "edit"}
              doctors={doctors.data ?? []}
              appointment={formAppointment}
              isSubmitting={updateAppointment.isPending}
              error={updateAppointment.error}
              onCancel={() => setFormAppointment(null)}
              onSubmit={submitUpdate}
            />
          </section>
        </div>
      ) : null}

      <AppointmentDetailsDialog appointment={detailsAppointment} onClose={() => setDetailsAppointment(null)} />
      <AppointmentConfirmDialog
        appointment={actionAppointment}
        action={action}
        error={currentMutationError}
        isSubmitting={isActionSubmitting}
        onCancel={() => setActionAppointment(null)}
        onConfirm={() => void confirmStatusAction()}
      />
    </div>
  );
}
