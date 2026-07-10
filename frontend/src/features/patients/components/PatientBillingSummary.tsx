import { Link } from "react-router-dom";

import { Card } from "../../../components/Card";
import { SectionHeader } from "../../../components/SectionHeader";
import type { UserRole } from "../../../types/auth";

interface PatientBillingSummaryProps {
  role: UserRole;
}

export function PatientBillingSummary({ role }: PatientBillingSummaryProps) {
  if (role === "DOCTOR") {
    return (
      <Card>
        <SectionHeader title="Billing handoffs" description="Doctors can use the My Billing Handoffs workspace for own handoff context." />
        <Link className="button secondary" to="/doctor/billing/handoffs">
          My Billing Handoffs
        </Link>
      </Card>
    );
  }

  return (
    <Card>
      <SectionHeader title="Billing/Handoff" description="Patient-specific billing details are planned for Phase 13I." />
      <p className="panel-note">This profile tab is read-only in Phase 13E and does not invent invoice data.</p>
      <Link className="button secondary inline-action" to={role === "STAFF" ? "/staff/billing/handoffs" : "/admin/billing"}>
        Billing workspace
      </Link>
    </Card>
  );
}
