import { useQuery } from "@tanstack/react-query";

import { clinicApi } from "../../../api/endpoints/clinic";
import type { ClinicSafeSettings } from "../../../types/clinic";

export type ValidClinicSafeSettings = Pick<
  ClinicSafeSettings,
  "allowed_durations_minutes" | "default_appointment_duration_minutes" | "timezone" | "capacity_per_slot"
>;

export function clinicSettingsKey() {
  return ["clinic-settings"] as const;
}

export function normalizeClinicSafeSettings(value: unknown): ValidClinicSafeSettings {
  if (!value || typeof value !== "object") throw new Error("Invalid clinic settings.");
  const settings = value as Partial<ClinicSafeSettings>;
  const durations = settings.allowed_durations_minutes;
  const defaultDuration = settings.default_appointment_duration_minutes;
  const capacity = settings.capacity_per_slot;
  if (!Array.isArray(durations) || !durations.length || !durations.every((duration) => Number.isInteger(duration) && duration > 0)) {
    throw new Error("Invalid clinic settings.");
  }
  const uniqueDurations = [...new Set(durations)];
  if (uniqueDurations.length !== durations.length || typeof defaultDuration !== "number" || !Number.isInteger(defaultDuration) || !uniqueDurations.includes(defaultDuration)) {
    throw new Error("Invalid clinic settings.");
  }
  if (typeof settings.timezone !== "string" || !settings.timezone.trim() || typeof capacity !== "number" || !Number.isInteger(capacity) || capacity < 1) {
    throw new Error("Invalid clinic settings.");
  }
  return {
    allowed_durations_minutes: uniqueDurations,
    default_appointment_duration_minutes: defaultDuration,
    timezone: settings.timezone,
    capacity_per_slot: capacity,
  };
}

export function useClinicSafeSettings() {
  return useQuery({
    queryKey: clinicSettingsKey(),
    queryFn: async () => normalizeClinicSafeSettings(await clinicApi.getSettings()),
  });
}
