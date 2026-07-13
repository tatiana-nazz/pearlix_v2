import { Card } from "../../../components/Card";
import { SectionHeader } from "../../../components/SectionHeader";
import { useFeatureT } from "../../../layouts/i18n";
import type { PatientDetail } from "../../../types/patients";
import { formatDate, formatDateTime } from "../../../utils/dates";
import { displayText } from "../../../utils/formatters";

export function PatientOverview({ patient }: { patient: PatientDetail }) {
  const t = useFeatureT(); const gender = patient.gender === "Male" ? t("male") : t("female");
  return <Card><SectionHeader title={t("overview")} description={t("profileOverviewDescription")} /><dl className="detail-grid"><div><dt>{t("phone")}</dt><dd className="bidi-isolate">{displayText(patient.phone_number)}</dd></div><div><dt>{t("email")}</dt><dd className="bidi-isolate">{displayText(patient.email)}</dd></div><div><dt>{t("nationalId")}</dt><dd className="bidi-isolate">{displayText(patient.national_id_or_passport)}</dd></div><div><dt>{t("emergencyContact")}</dt><dd className="bidi-isolate">{displayText(patient.emergency_contact)}</dd></div><div><dt>{t("gender")}</dt><dd>{gender}</dd></div><div><dt>{t("dateOfBirth")}</dt><dd className="bidi-isolate">{patient.date_of_birth ? formatDate(patient.date_of_birth) : t("notRecorded")}</dd></div><div><dt>{t("age")}</dt><dd className="bidi-isolate">{patient.age ? `${patient.age} ${t("yearsOld")}` : t("notRecorded")}</dd></div><div><dt>{t("bloodGroup")}</dt><dd className="bidi-isolate">{displayText(patient.blood_group)}</dd></div><div><dt>{t("version")}</dt><dd className="bidi-isolate">{patient.version}</dd></div><div className="detail-wide"><dt>{t("address")}</dt><dd>{displayText(patient.address)}</dd></div><div><dt>{t("created")}</dt><dd className="bidi-isolate">{formatDateTime(patient.created_at)}</dd></div><div><dt>{t("updated")}</dt><dd className="bidi-isolate">{formatDateTime(patient.updated_at)}</dd></div><div><dt>{t("createdBy")}</dt><dd className="bidi-isolate">{patient.created_by?.full_name ?? t("notRecorded")}</dd></div><div><dt>{t("updatedBy")}</dt><dd className="bidi-isolate">{patient.updated_by?.full_name ?? t("notRecorded")}</dd></div></dl></Card>;
}
