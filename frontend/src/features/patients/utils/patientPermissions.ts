import type { UserRole } from "../../../types/auth";
import type { PatientDetail, PatientListItem } from "../../../types/patients";

export interface PatientPermissions {
  canCreate: boolean;
  canViewArchivedFilter: boolean;
  canViewDoctorWorkflowFilters: boolean;
  canEdit: boolean;
  canArchive: boolean;
  canUnarchive: boolean;
  canViewBillingTab: boolean;
}

export function getPatientPermissions(role: UserRole, patient?: PatientDetail | PatientListItem | null): PatientPermissions {
  const isArchived = Boolean(patient?.is_archived);
  return {
    canCreate: role === "STAFF",
    canViewArchivedFilter: role === "STAFF" || role === "ADMIN",
    canViewDoctorWorkflowFilters: role === "DOCTOR",
    canEdit: (role === "STAFF" || role === "DOCTOR") && !isArchived,
    canArchive: role === "STAFF" && !isArchived,
    canUnarchive: role === "STAFF" && isArchived,
    canViewBillingTab: role === "STAFF" || role === "ADMIN",
  };
}

export function patientProfilePath(role: UserRole, patientId: number): string {
  return `/${role.toLowerCase()}/patients/${patientId}`;
}

export function patientListPath(role: UserRole): string {
  return `/${role.toLowerCase()}/patients`;
}

export function newPatientPath(role: UserRole): string {
  return `/${role.toLowerCase()}/patients/new`;
}
