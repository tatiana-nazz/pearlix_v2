import { useLocation, useNavigate } from "react-router-dom";

import { ClickableRow } from "../../../components/v2";
import { useFeatureT } from "../../../layouts/i18n";
import type { UserRole } from "../../../types/auth";
import type { PatientListItem } from "../../../types/patients";
import { formatDateTime } from "../../../utils/dates";
import { displayText } from "../../../utils/formatters";
import { patientDetailNavigation } from "../utils/patientListNavigation";

interface PatientTableProps { role: UserRole; patients: PatientListItem[]; }

function initials(patient: PatientListItem) {
  return `${patient.first_name.slice(0, 1)}${patient.last_name.slice(0, 1)}`.trim().toLocaleUpperCase() || patient.full_name.slice(0, 2).toLocaleUpperCase();
}

function genderLabel(patient: PatientListItem, t: ReturnType<typeof useFeatureT>) {
  return patient.gender === "Male" ? t("male") : t("female");
}

export function PatientTable({ role, patients }: PatientTableProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const t = useFeatureT();

  return <table className="patient-table"><thead><tr><th>{t("patient")}</th><th>{t("patientListContact")}</th><th>{t("gender")}</th><th>{t("patientListLastVisit")}</th></tr></thead><tbody>{patients.map((patient) => {
    const demographic = patient.age !== null && patient.age !== undefined ? `${patient.age} ${t("yearsOld")} · ${genderLabel(patient, t)}` : genderLabel(patient, t);
    const lastVisit = patient.last_visit_with_me_at ? formatDateTime(patient.last_visit_with_me_at) : t("notRecorded");
    return <ClickableRow key={patient.id} ariaLabel={patient.full_name} showDisclosure={false} onOpen={() => navigate(patientDetailNavigation(role, patient.id, location.search))}>
      <td><div className="patient-identity"><span className="patient-initials" aria-hidden="true">{initials(patient)}</span><span><strong className="bidi-isolate">{patient.full_name}</strong><small>{demographic}</small>{patient.is_archived ? <small className="patient-archived">{t("archived")}</small> : null}</span></div></td>
      <td><span className="patient-contact"><bdi>{displayText(patient.phone_number, t("notRecorded"))}</bdi>{patient.email ? <bdi>{patient.email}</bdi> : null}</span></td>
      <td>{genderLabel(patient, t)}</td>
      <td><bdi>{lastVisit}</bdi></td>
    </ClickableRow>;
  })}</tbody></table>;
}
