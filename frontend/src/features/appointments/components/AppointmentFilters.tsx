import type { AppointmentStatus } from "../../../types/appointments";
import type { DoctorListItem } from "../../../types/schedule";
import { useFeatureT } from "../../../layouts/i18n";
import { statusLabel } from "../../../components/v2";

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
  const t = useFeatureT();
  return (
    <section className="appointment-filters" aria-label={t("appointments")}>
      <label>
        {t("date")}
        <input type="date" value={date} onChange={(event) => onDateChange(event.target.value)} />
      </label>
      <label>
        {t("status")}
        <select value={status} onChange={(event) => onStatusChange(event.target.value as AppointmentStatusFilter)}>
          {statusOptions.map((option) => (
            <option key={option} value={option}>
              {option === "ALL" ? t("all") : statusLabel(option)}
            </option>
          ))}
        </select>
      </label>
      {showDoctorFilter ? (
        <label>
          {t("doctor")}
          <select value={doctorId} onChange={(event) => onDoctorChange(event.target.value)}>
            <option value="">{t("allDoctors")}</option>
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
