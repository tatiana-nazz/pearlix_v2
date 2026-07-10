import type { UserRole } from "../../../types/auth";
import { getPatientPermissions } from "../utils/patientPermissions";

export type PatientProfileTab = "overview" | "medical" | "visits" | "appointments" | "xrays" | "billing";

const baseTabs: Array<{ id: PatientProfileTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "medical", label: "Medical Summary" },
  { id: "visits", label: "Visits" },
  { id: "appointments", label: "Appointments" },
  { id: "xrays", label: "X-rays & AI" },
];

interface PatientProfileTabsProps {
  role: UserRole;
  activeTab: PatientProfileTab;
  onTabChange: (tab: PatientProfileTab) => void;
}

export function PatientProfileTabs({ role, activeTab, onTabChange }: PatientProfileTabsProps) {
  const tabs = getPatientPermissions(role).canViewBillingTab ? [...baseTabs, { id: "billing" as const, label: "Billing/Handoff" }] : baseTabs;

  return (
    <div className="profile-tabs" role="tablist" aria-label="Patient profile sections">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={activeTab === tab.id}
          className={activeTab === tab.id ? "active" : ""}
          type="button"
          onClick={() => onTabChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
