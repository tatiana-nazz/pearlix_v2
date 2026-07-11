import type { ClinicalNotesPayload, VisitDetail } from "../../../types/visits";

export type ClinicalNotesValues = Required<ClinicalNotesPayload>;

export function clinicalNotesValues(visit: VisitDetail): ClinicalNotesValues {
  return {
    symptoms: visit.symptoms,
    diagnosis: visit.diagnosis,
    treatment: visit.treatment,
    clinical_notes: visit.clinical_notes,
    follow_up_notes: visit.follow_up_notes,
  };
}

export function areClinicalNotesEqual(left: ClinicalNotesValues, right: ClinicalNotesValues): boolean {
  return Object.keys(left).every((key) => left[key as keyof ClinicalNotesValues] === right[key as keyof ClinicalNotesValues]);
}
