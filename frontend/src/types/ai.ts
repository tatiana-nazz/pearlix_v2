export type AIResultStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

export interface AIFinding {
  fdi_tooth_id?: string;
  disease_label?: string;
  confidence_score?: number;
  confidence_percent?: number;
  [key: string]: unknown;
}

export interface AIResult {
  id: number;
  xray_attachment: {
    id: number;
    patient_id: number;
    visit_id: number | null;
    title: string;
    original_file_name: string;
    created_at: string;
  } | null;
  external_xray_case: {
    id: number;
    status: string;
    title: string;
    original_file_name: string;
    created_at: string;
  } | null;
  status: AIResultStatus;
  result_summary: string;
  overall_confidence: number | null;
  overall_confidence_percent: number | null;
  findings: AIFinding[];
  overlay_available: boolean;
  model_version: string;
  error_message: string;
  disclaimer: string;
  disclaimer_ar: string;
  created_at: string;
  updated_at: string;
}
