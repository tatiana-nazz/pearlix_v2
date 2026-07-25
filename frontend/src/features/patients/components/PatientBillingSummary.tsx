import { Link } from "react-router-dom";

import { Card } from "../../../components/Card";
import { SectionHeader } from "../../../components/SectionHeader";
import type { UserRole } from "../../../types/auth";

interface PatientBillingSummaryProps {
  role: UserRole;
  patientId?: number;
}

export function PatientBillingSummary({ role, patientId }: PatientBillingSummaryProps) {
  if (role === "DOCTOR") {
    return (
      <Card>
        <SectionHeader title="Billing handoffs" description="Invoice and payment operations are not available in the Doctor workspace. Completed-visit handoffs remain available from the related visit." />
      </Card>
    );
  }

  return (
    <Card>
      <SectionHeader title="Billing/Handoff" description="Open the real billing workspace to review this patient's invoices and handoffs." />
      <Link className="button secondary inline-action" to={`/${role.toLowerCase()}/billing/invoices${patientId ? `?patient_id=${patientId}` : ""}`}>
        Patient invoices
      </Link>
    </Card>
  );
}
