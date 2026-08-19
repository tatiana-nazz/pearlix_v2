import { type KeyboardEvent } from "react";

import { useAuthStore } from "../../../auth/authStore";
import type { UserRole } from "../../../types/auth";
import { patientCopy } from "../i18n";
import { getPatientPermissions } from "../utils/patientPermissions";

export type PatientProfileTab = "overview" | "visits" | "appointments" | "xrays" | "billing";

interface PatientProfileTabsProps {
  role: UserRole;
  activeTab: PatientProfileTab;
  onTabChange: (tab: PatientProfileTab) => void;
  idPrefix?: string;
}

export function PatientProfileTabs({ role, activeTab, onTabChange, idPrefix = "patient-profile" }: PatientProfileTabsProps) {
  const language = useAuthStore((state) => state.user?.language_preference);
  const c = patientCopy(language);
  const baseTabs: Array<{ id: PatientProfileTab; label: string }> = [
    { id: "overview", label: c.overview }, { id: "visits", label: c.visits },
    { id: "appointments", label: c.appointments }, { id: "xrays", label: c.xraysAi },
  ];
  const tabs = getPatientPermissions(role).canViewBillingTab ? [...baseTabs, { id: "billing" as const, label: c.billing }] : baseTabs;

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const previous = language === "AR" ? "ArrowRight" : "ArrowLeft";
    const next = language === "AR" ? "ArrowLeft" : "ArrowRight";
    let target = index;
    if (event.key === previous) target = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === next) target = (index + 1) % tabs.length;
    else if (event.key === "Home") target = 0;
    else if (event.key === "End") target = tabs.length - 1;
    else return;
    event.preventDefault();
    onTabChange(tabs[target].id);
    document.getElementById(`${idPrefix}-tab-${tabs[target].id}`)?.focus();
  }

  return (
    <div className="profile-tabs" role="tablist" aria-label={c.patientProfile}>
      {tabs.map((tab, index) => (
        <button
          id={`${idPrefix}-tab-${tab.id}`}
          key={tab.id}
          role="tab"
          aria-selected={activeTab === tab.id}
          aria-controls={`${idPrefix}-panel-${tab.id}`}
          tabIndex={activeTab === tab.id ? 0 : -1}
          className={activeTab === tab.id ? "active" : ""}
          type="button"
          onClick={() => onTabChange(tab.id)}
          onKeyDown={(event) => onKeyDown(event, index)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
