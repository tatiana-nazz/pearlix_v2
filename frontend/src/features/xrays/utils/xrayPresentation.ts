import type { XraySource } from "../../../types/xrays";
import { displayText } from "../../../utils/formatters";

export const XRAY_MISSING_VALUE = "—";

export function xrayText(value: string | number | null | undefined): string {
  return displayText(value, XRAY_MISSING_VALUE);
}

export function xraySourceLabel(source: XraySource): string {
  return source === "ACTIVE_VISIT" ? "Active visit" : source === "PATIENT_PROFILE" ? "Patient profile" : "External workspace";
}

export function aiStatusLabel(hasResult: boolean): string {
  return hasResult ? "Result available" : "Not analyzed";
}
