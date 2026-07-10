export type Currency = "SYP" | "USD";
export type Language = "EN" | "AR";
export type AiMode = "DJANGO_INTERNAL" | "SEPARATE_SERVICE" | "MOCK_ADAPTER";

export interface ClinicSafeSettings {
  clinic_name: string;
  address: string;
  phone: string;
  email: string;
  timezone: string;
  capacity_per_slot: number;
  default_appointment_duration_minutes: number;
  allowed_durations_minutes: number[];
  default_currency: Currency;
  supported_currencies: Currency[];
  default_language: Language;
}

export interface ClinicSettings extends ClinicSafeSettings {
  ai_mode: AiMode;
  ai_service_url: string;
}

export type ClinicSettingsUpdatePayload = Partial<ClinicSettings>;
