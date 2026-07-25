import type { UserRole } from "../../../types/auth";
import { useAuthStore } from "../../../auth/authStore";
import { patientCopy } from "../i18n";

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
  onClear?: () => void;
}

export function PatientFilters({
  role,
  search,
  archiveFilter,
  doctorFilter,
  onSearchChange,
  onArchiveFilterChange,
  onDoctorFilterChange,
  onClear = () => undefined,
}: PatientFiltersProps) {
  const c = patientCopy(useAuthStore((state) => state.user?.language_preference));
  return (
    <section className="patient-filters" aria-label={c.patientFilters}>
      <label>
        {c.search}
        <input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={c.searchPlaceholder}
          aria-label={c.search}
        />
      </label>

      {role !== "DOCTOR" ? (
        <label>
          {c.archiveState}
          <select value={archiveFilter} onChange={(event) => onArchiveFilterChange(event.target.value as ArchiveFilter)}>
            <option value="active">{c.active}</option>
            <option value="archived">{c.archived}</option>
          </select>
        </label>
      ) : null}

      <button className="button secondary compact-button" type="button" onClick={onClear}>{c.clearFilters}</button>

      {role === "DOCTOR" ? (
        <label>
          {c.patientScope}
          <select value={doctorFilter} onChange={(event) => onDoctorFilterChange(event.target.value as DoctorWorkflowFilter)}>
            <option value="all">{c.allPatients}</option>
            <option value="my_patients">{c.myPatients}</option>
            <option value="upcoming_with_me">{c.upcomingWithMe}</option>
            <option value="last_visit_with_me">{c.lastVisitWithMe}</option>
          </select>
        </label>
      ) : null}
    </section>
  );
}
