import type { UserRole } from "../../../types/auth";
import { useFeatureT } from "../../../layouts/i18n";

export type ArchiveFilter = "active" | "archived";
export type DoctorWorkflowFilter = "all" | "my_patients" | "upcoming_with_me" | "last_visit_with_me";

interface PatientFiltersProps {
  role: UserRole;
  search: string;
  archiveFilter: ArchiveFilter;
  doctorFilter: DoctorWorkflowFilter;
  onSearchChange: (value: string) => void;
  onArchiveFilterChange: (value: ArchiveFilter) => void;
  onDoctorFilterChange: (value: DoctorWorkflowFilter) => void;
}

export function PatientFilters({
  role,
  search,
  archiveFilter,
  doctorFilter,
  onSearchChange,
  onArchiveFilterChange,
  onDoctorFilterChange,
}: PatientFiltersProps) {
  const t = useFeatureT();
  return (
    <section className="patient-filters" aria-label={t("patientFilters")}>
      <label>
        {t("search")}
        <input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={t("searchPatientHelp")}
          aria-label={t("searchPatients")}
        />
      </label>

      {role !== "DOCTOR" ? (
        <label>
          {t("archiveState")}
          <select value={archiveFilter} onChange={(event) => onArchiveFilterChange(event.target.value as ArchiveFilter)}>
            <option value="active">{t("active")}</option>
            <option value="archived">{t("archived")}</option>
          </select>
        </label>
      ) : null}

      {role === "DOCTOR" ? (
        <label>
          {t("patientScope")}
          <select value={doctorFilter} onChange={(event) => onDoctorFilterChange(event.target.value as DoctorWorkflowFilter)}>
            <option value="all">{t("allPatients")}</option>
            <option value="my_patients">{t("myPatients")}</option>
            <option value="upcoming_with_me">{t("upcomingWithMe")}</option>
            <option value="last_visit_with_me">{t("lastVisitWithMe")}</option>
          </select>
        </label>
      ) : null}
    </section>
  );
}
