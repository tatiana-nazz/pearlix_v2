import type { UserRole } from "../../../types/auth";
import type { ExternalXrayCase, XrayAttachment } from "../../../types/xrays";

export function canUploadPatientXray(role: UserRole): boolean {
  return role === "DOCTOR";
}

export function canUploadVisitXray(role: UserRole, currentUserId: number | undefined, doctorId: number): boolean {
  return role === "DOCTOR" && currentUserId === doctorId;
}

export function canRunSavedXrayAi(role: UserRole, xray?: XrayAttachment): boolean {
  return role === "DOCTOR" && Boolean(xray);
}

export function canDeleteSavedXray(role: UserRole, currentUserId: number | undefined, xray?: XrayAttachment): boolean {
  return role === "DOCTOR" && Boolean(xray && xray.uploaded_by.id === currentUserId);
}

export function canManageExternalXray(role: UserRole, currentUserId: number | undefined, external: ExternalXrayCase): boolean {
  return external.status === "TEMPORARY" && (role === "ADMIN" || (role === "DOCTOR" && external.uploaded_by.id === currentUserId));
}

export function canRunExternalXrayAi(role: UserRole, currentUserId: number | undefined, external: ExternalXrayCase): boolean {
  return canManageExternalXray(role, currentUserId, external);
}

export function canAttachExternalXray(role: UserRole, currentUserId: number | undefined, external: ExternalXrayCase): boolean {
  return role === "DOCTOR" && external.status === "TEMPORARY" && external.uploaded_by.id === currentUserId;
}
