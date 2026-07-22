import { type KeyboardEvent, useRef } from "react";

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
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  function selectTab(index: number) {
    const tab = tabs[index];
    if (!tab) return;
    onTabChange(tab.id);
    window.requestAnimationFrame(() => tabRefs.current[tab.id]?.focus());
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const rtl = document.documentElement.dir === "rtl";
    const direction = event.key === "ArrowRight" ? (rtl ? -1 : 1) : (rtl ? 1 : -1);
    const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + direction + tabs.length) % tabs.length;
    selectTab(nextIndex);
  }

  return (
    <div className="profile-tabs" role="tablist" aria-label={t("patientProfile")} aria-orientation="horizontal">
      {tabs.map((tab, index) => (
        <button
          key={tab.id}
          ref={(element) => { tabRefs.current[tab.id] = element; }}
          id={`patient-profile-tab-${tab.id}`}
          role="tab"
          aria-selected={activeTab === tab.id}
          aria-controls={`patient-profile-panel-${tab.id}`}
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
