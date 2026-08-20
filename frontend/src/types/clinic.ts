export type Currency = "SYP" | "USD";
export type Language = "EN" | "AR";
export type AiMode = "DJANGO_INTERNAL" | "SEPARATE_SERVICE" | "MOCK_ADAPTER";
export type ClinicWeekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

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
  weekly_closed_days: ClinicWeekday[];
}

export interface ClinicSettings extends ClinicSafeSettings {
  ai_mode: AiMode;
  ai_service_url: string;
}

export interface ClinicSettingsUpdatePayload extends Partial<ClinicSettings> {
  confirm_appointment_impact?: boolean;
}

export interface ClinicSettingsUpdateResponse extends ClinicSettings {
  affected_appointments_count: number;
  restored_appointments_count: number;
  still_blocked_appointments_count: number;
}

export interface ClinicClosureImpactAppointment {
  id: number;
  patient_name: string;
  start_datetime: string;
  end_datetime: string;
  status: string;
}

export interface ClinicClosureImpact {
  impacted_count: number;
  appointments: ClinicClosureImpactAppointment[];
  proposed_weekly_closed_days: ClinicWeekday[];
}
