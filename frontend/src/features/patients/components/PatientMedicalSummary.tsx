import { Card } from "../../../components/Card";
import { EmptyState } from "../../../components/EmptyState";
import { SectionHeader } from "../../../components/SectionHeader";
import { useFeatureT } from "../../../layouts/i18n";
import type { UserRole } from "../../../types/auth";
import type { PatientDetail } from "../../../types/patients";
import { getPatientPermissions } from "../utils/patientPermissions";

export function PatientMedicalSummary({ role, patient, onEdit }: { role: UserRole; patient: PatientDetail; onEdit: () => void }) {
  const t = useFeatureT(); const hasSummary = Boolean(patient.medical_conditions_history || patient.insurance_info || patient.general_notes); const canEdit = getPatientPermissions(role, patient).canEdit;
  return <Card><SectionHeader title={t("medicalSummary")} description={t("medicalSummaryDescription")} />{hasSummary ? <div className="medical-summary-grid"><section><h3>{t("medicalHistory")}</h3><p>{patient.medical_conditions_history || t("noMedicalHistory")}</p></section><section><h3>{t("insuranceInfo")}</h3><p>{patient.insurance_info || t("noInsuranceInfo")}</p></section><section><h3>{t("generalNotes")}</h3><p>{patient.general_notes || t("noGeneralNotes")}</p></section></div> : <EmptyState title={t("noMedicalSummary")} />}{canEdit ? <button className="button secondary inline-action" type="button" onClick={onEdit}>{t("editSummary")}</button> : null}</Card>;
}
