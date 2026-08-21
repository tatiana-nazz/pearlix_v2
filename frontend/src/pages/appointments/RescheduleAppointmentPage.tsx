import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { clinicApi, clinicSettingsQueryKey } from "../../api/endpoints/clinic";

import { ErrorState } from "../../components/ErrorState";
import { LoadingState } from "../../components/LoadingState";
import { PageHeader } from "../../components/PageHeader";
import { RescheduleAppointmentPanel } from "../../features/appointments/components/RescheduleAppointmentPanel";
import { useUpdateAppointment } from "../../features/appointments/hooks/useAppointmentMutations";
import { useAppointment } from "../../features/appointments/hooks/useAppointments";
import { useDoctors } from "../../features/appointments/hooks/useDoctors";
import { appointmentViewPath } from "../../features/appointments/utils/appointmentPermissions";

export function RescheduleAppointmentPage() {
  const navigate = useNavigate();
  const appointmentId = Number(useParams().appointmentId);
  const appointment = useAppointment(appointmentId);
  const doctors = useDoctors();
  const updateAppointment = useUpdateAppointment(appointmentId);
  const clinicSettings = useQuery({ queryKey: clinicSettingsQueryKey, queryFn: clinicApi.getSettings, staleTime: 300_000 });

  return (
    <div className="appointment-page">
      <PageHeader
        eyebrow="staff workspace"
        title="Reschedule Appointment"
        description="Choose a backend availability slot and save the appointment without direct status mutation."
        actions={
          <Link className="button secondary" to={appointmentViewPath("STAFF", "needs-reschedule")}>
            Back to Needs Reschedule
          </Link>
        }
      />
      {appointment.isLoading || doctors.isLoading ? <LoadingState title="Loading reschedule details..." /> : null}
      {appointment.isError ? <ErrorState error={appointment.error} onRetry={() => void appointment.refetch()} title="Unable to load appointment" /> : null}
      {doctors.isError ? <ErrorState error={doctors.error} onRetry={() => void doctors.refetch()} title="Unable to load doctors" /> : null}
      {appointment.data && doctors.data ? (
        <RescheduleAppointmentPanel
          appointment={appointment.data}
          doctors={doctors.data}
          isSubmitting={updateAppointment.isPending}
          error={updateAppointment.error}
          clinicTimezone={clinicSettings.data?.timezone}
          onSubmit={async (payload) => {
            await updateAppointment.mutateAsync(payload);
            navigate(appointmentViewPath("STAFF", "needs-reschedule"));
          }}
        />
      ) : null}
    </div>
  );
}
