import type { UserRole } from "../../../types/auth";
import type { VisitDetail } from "../../../types/visits";

export function getVisitPermissions(role: UserRole, currentUserId: number | undefined, visit: VisitDetail) {
  const isOwnVisit = role === "DOCTOR" && currentUserId === visit.doctor.id;

  return {
    isOwnVisit,
    canEditClinicalNotes: isOwnVisit,
    canCompleteVisit: isOwnVisit && visit.status === "ACTIVE",
  };
}
