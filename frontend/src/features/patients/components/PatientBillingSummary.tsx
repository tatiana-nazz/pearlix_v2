import { Link } from "react-router-dom";

import { Card } from "../../../components/Card";
import { SectionHeader } from "../../../components/SectionHeader";
import { useFeatureT } from "../../../layouts/i18n";
import type { UserRole } from "../../../types/auth";

interface PatientBillingSummaryProps {
  role: UserRole;
  patientId?: number;
}

export function PatientBillingSummary({ role, patientId }: PatientBillingSummaryProps) {
  const t = useFeatureT();
  if (role === "DOCTOR") {
    return (
      <Card>
        <SectionHeader title={t("billingHandoffs")} description={t("patientBillingDoctorDescription")} />
        <Link className="button secondary" to="/doctor/billing/handoffs">
          {t("myBillingHandoffs")}
        </Link>
      </Card>
    );
  }

  return (
    <Card>
      <SectionHeader title={t("billingHandoff")} description={t("patientBillingDescription")} />
      <Link className="button secondary inline-action" to={`/${role.toLowerCase()}/billing/invoices${patientId ? `?patient_id=${patientId}` : ""}`}>
        {t("patientInvoices")}
      </Link>
    </Card>
  );
}
