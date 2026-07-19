import type { UserRole } from "../../../types/auth";
import { patientListPath, patientProfilePath } from "./patientPermissions";

/** Shared patient-list contract: detail navigation preserves list state and never relies on row controls. */
export function patientDetailNavigation(role: UserRole, patientId: number, listSearch: string) {
  return { pathname: patientProfilePath(role, patientId), search: listSearch };
}

export function patientListNavigation(role: UserRole, detailSearch: string) {
  const params = new URLSearchParams(detailSearch);
  params.delete("tab");
  params.delete("edit");
  const search = params.toString();
  return { pathname: patientListPath(role), search: search ? `?${search}` : "" };
}
