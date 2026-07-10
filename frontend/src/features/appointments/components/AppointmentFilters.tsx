import type { AppointmentStatus } from "../../../types/appointments";
import type { DoctorListItem } from "../../../types/schedule";

export type AppointmentStatusFilter = AppointmentStatus | "ALL";

interface AppointmentFiltersProps {
  date: string;
  status: AppointmentStatusFilter;
  doctorId: string;
  doctors: DoctorListItem[];
  showDoctorFilter: boolean;
  onDateChange: (value: string) => void;
  onStatusChange: (value: AppointmentStatusFilter) => void;
  onDoctorChange: (value: string) => void;
}

const statusOptions: AppointmentStatusFilter[] = [
  "ALL",
  "UPCOMING",
  "CHECKED_IN",
  "ACTIVE",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
  "NEEDS_RESCHEDULE",
];

export function AppointmentFilters({
  date,
  status,
  doctorId,
  doctors,
  showDoctorFilter,
  onDateChange,
  onStatusChange,
  onDoctorChange,
}: AppointmentFiltersProps) {
  return (
    <section className="appointment-filters" aria-label="Appointment filters">
      <label>
        Date
        <input type="date" value={date} onChange={(event) => onDateChange(event.target.value)} />
      </label>
      <label>
        Status
        <select value={status} onChange={(event) => onStatusChange(event.target.value as AppointmentStatusFilter)}>
          {statusOptions.map((option) => (
            <option key={option} value={option}>
              {option.split("_").join(" ")}
            </option>
          ))}
        </select>
      </label>
      {showDoctorFilter ? (
        <label>
          Doctor
          <select value={doctorId} onChange={(event) => onDoctorChange(event.target.value)}>
            <option value="">All Doctors</option>
            {doctors.map((doctor) => (
              <option key={doctor.id} value={doctor.id}>
                {doctor.full_name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </section>
  );
}
