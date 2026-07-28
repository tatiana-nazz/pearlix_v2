import type { UserRole } from "../../../types/auth";
import { getPatientPermissions } from "../utils/patientPermissions";
import { useFeatureT } from "../../../layouts/i18n";

export type PatientProfileTab = "overview" | "medical" | "visits" | "appointments" | "xrays" | "billing";


interface PatientProfileTabsProps {
  role: UserRole;
  activeTab: PatientProfileTab;
  onTabChange: (tab: PatientProfileTab) => void;
}

export function PatientProfileTabs({ role, activeTab, onTabChange }: PatientProfileTabsProps) {
  const t = useFeatureT(); const baseTabs: Array<{ id: PatientProfileTab; label: string }> = [{ id:"overview", label:t("overview") }, { id:"medical", label:t("medicalSummary") }, { id:"visits", label:t("visits") }, { id:"appointments", label:t("appointments") }, { id:"xrays", label:t("xraysAi") }];
  const tabs = getPatientPermissions(role).canViewBillingTab ? [...baseTabs, { id: "billing" as const, label: t("billingHandoff") }] : baseTabs;

  return (
    <div className="profile-tabs" role="tablist" aria-label={t("patientProfile")}>
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
