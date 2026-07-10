import type { Timestamped } from "./api";
import type { UserSummary } from "./auth";
import type { PatientList } from "./patients";
import type { VisitStatus } from "./visits";

export type XraySource = "ACTIVE_VISIT" | "PATIENT_PROFILE" | "EXTERNAL_WORKSPACE";
export type ExternalXrayStatus = "TEMPORARY" | "ATTACHED_TO_PATIENT" | "DISCARDED";

export interface XrayVisitSummary {
  id: number;
  status: VisitStatus;
  started_at: string;
  completed_at: string | null;
}

export interface XrayAttachment extends Timestamped {
  id: number;
  patient: PatientList;
  visit: XrayVisitSummary | null;
  uploaded_by: UserSummary;
  source: XraySource;
  title: string;
  notes: string;
  stored_file_name: string;
  original_file_name: string;
  content_type: string;
  size_bytes: number;
  file_endpoint: string;
  ai_result_endpoint: string;
  ai_overlay_endpoint: string;
  has_ai_result: boolean;
}

export interface ExternalXrayCase extends Timestamped {
  id: number;
  uploaded_by: UserSummary;
  title: string;
  notes: string;
  status: ExternalXrayStatus;
  stored_file_name: string;
  original_file_name: string;
  content_type: string;
  size_bytes: number;
  attached_patient: PatientList | null;
  attached_visit: XrayVisitSummary | null;
  attached_xray: XrayAttachment | null;
  discarded_at: string | null;
  attached_at: string | null;
  file_endpoint: string;
  ai_result_endpoint: string;
  ai_overlay_endpoint: string;
  has_ai_result: boolean;
}

export interface XrayUploadPayload {
  file: File;
  title?: string;
  notes?: string;
}

export interface ExternalAttachPayload {
  patient_id: number;
  visit_id?: number | null;
  title?: string;
  notes?: string;
}
