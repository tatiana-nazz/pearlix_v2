import type { UserRole } from "../../../types/auth";

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
  return (
    <section className="patient-filters" aria-label="Patient filters">
      <label>
        Search
        <input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search by name, phone, email, or ID"
          aria-label="Search patients"
        />
      </label>

      {role !== "DOCTOR" ? (
        <label>
          Archive state
          <select value={archiveFilter} onChange={(event) => onArchiveFilterChange(event.target.value as ArchiveFilter)}>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
        </label>
      ) : null}

      {role === "DOCTOR" ? (
        <label>
          Patient scope
          <select value={doctorFilter} onChange={(event) => onDoctorFilterChange(event.target.value as DoctorWorkflowFilter)}>
            <option value="all">All Patients</option>
            <option value="my_patients">My Patients</option>
            <option value="upcoming_with_me">Upcoming With Me</option>
            <option value="last_visit_with_me">Last Visit With Me</option>
          </select>
        </label>
      ) : null}
    </section>
  );
}
