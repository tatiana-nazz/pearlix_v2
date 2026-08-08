import type { UserRole } from "../../types/auth";

export type EffectiveAccessLevel = "MANAGE" | "READ_ONLY" | "OWN_RECORDS" | "OPERATIONAL" | "NO_ACCESS";

export type EffectiveAccessCategory =
  | "PATIENTS"
  | "APPOINTMENTS"
  | "CLINICAL_VISITS"
  | "XRAYS_AI"
  | "BILLING_INVOICES"
  | "PAYMENTS"
  | "TEAM"
  | "USERS_ACCESS"
  | "SCHEDULES_LEAVE"
  | "CLINIC_SETTINGS"
  | "AUDIT_LOGS";

export interface EffectiveAccessItem {
  category: EffectiveAccessCategory;
  level: EffectiveAccessLevel;
}

/**
 * Presentation-only summary of the existing backend permission classes.
 * The backend remains the authorization authority; this model is never sent
 * to an API and deliberately contains no per-user overrides.
 */
const accessByRole: Record<UserRole, readonly EffectiveAccessItem[]> = {
  ADMIN: [
    { category: "PATIENTS", level: "READ_ONLY" },
    { category: "APPOINTMENTS", level: "READ_ONLY" },
    { category: "CLINICAL_VISITS", level: "READ_ONLY" },
    { category: "XRAYS_AI", level: "OPERATIONAL" },
    { category: "BILLING_INVOICES", level: "READ_ONLY" },
    { category: "PAYMENTS", level: "READ_ONLY" },
    { category: "TEAM", level: "MANAGE" },
    { category: "USERS_ACCESS", level: "MANAGE" },
    { category: "SCHEDULES_LEAVE", level: "MANAGE" },
    { category: "CLINIC_SETTINGS", level: "MANAGE" },
    { category: "AUDIT_LOGS", level: "READ_ONLY" },
  ],
  STAFF: [
    { category: "PATIENTS", level: "MANAGE" },
    { category: "APPOINTMENTS", level: "MANAGE" },
    { category: "CLINICAL_VISITS", level: "READ_ONLY" },
    { category: "XRAYS_AI", level: "READ_ONLY" },
    { category: "BILLING_INVOICES", level: "MANAGE" },
    { category: "PAYMENTS", level: "MANAGE" },
    { category: "TEAM", level: "READ_ONLY" },
    { category: "USERS_ACCESS", level: "NO_ACCESS" },
    { category: "SCHEDULES_LEAVE", level: "OPERATIONAL" },
    { category: "CLINIC_SETTINGS", level: "READ_ONLY" },
    { category: "AUDIT_LOGS", level: "NO_ACCESS" },
  ],
  DOCTOR: [
    { category: "PATIENTS", level: "OWN_RECORDS" },
    { category: "APPOINTMENTS", level: "OWN_RECORDS" },
    { category: "CLINICAL_VISITS", level: "OWN_RECORDS" },
    { category: "XRAYS_AI", level: "OWN_RECORDS" },
    { category: "BILLING_INVOICES", level: "OPERATIONAL" },
    { category: "PAYMENTS", level: "NO_ACCESS" },
    { category: "TEAM", level: "NO_ACCESS" },
    { category: "USERS_ACCESS", level: "NO_ACCESS" },
    { category: "SCHEDULES_LEAVE", level: "OWN_RECORDS" },
    { category: "CLINIC_SETTINGS", level: "READ_ONLY" },
    { category: "AUDIT_LOGS", level: "NO_ACCESS" },
  ],
};

export function effectiveAccessForRole(role: UserRole): readonly EffectiveAccessItem[] {
  return accessByRole[role];
}
