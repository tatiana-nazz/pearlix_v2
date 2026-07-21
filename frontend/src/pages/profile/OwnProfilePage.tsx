import { useSearchParams } from "react-router-dom";

import { useAuthStore } from "../../auth/authStore";
import { ChangePasswordForm } from "../../components/ChangePasswordForm";
import { WorkspaceTabs } from "../../components/WorkspaceTabs";
import { PageHeaderV2, SurfaceCard } from "../../components/v2";
import { featureT, roleT, t } from "../../layouts/i18n";
import { OwnLeavePage } from "./OwnLeavePage";
import { OwnSchedulePage } from "./OwnSchedulePage";

export function OwnProfilePage() {
  const user = useAuthStore((state) => state.user);
  const role = useAuthStore((state) => state.role);
  const language = user?.language_preference ?? "EN";
  const [params] = useSearchParams();
  const tab = params.get("tab") ?? "personal";
  const profileT = (key: "profileDescription" | "fullName" | "email" | "role" | "currentLanguage" | "currentTheme" | "passwordChangeState" | "passwordChangeRequired" | "passwordCurrent" | "personalInformation" | "schedule" | "leave" | "security" | "profileTabs" | "securityDescription") => featureT(language, key);
  const tabs = role === "ADMIN" ? [{ id: "personal", label: profileT("personalInformation") }, { id: "security", label: profileT("security") }] : [{ id: "personal", label: profileT("personalInformation") }, { id: "schedule", label: profileT("schedule") }, { id: "leave", label: profileT("leave") }, { id: "security", label: profileT("security") }];
  const selected = tabs.some((item) => item.id === tab) ? tab : "personal";
  const languageLabel = user?.language_preference === "AR" ? "العربية" : "English";
  const themeLabel = user?.theme_preference === "LIGHT" ? t(language, "light") : user?.theme_preference === "DARK" ? t(language, "dark") : t(language, "system");

  return <div className="admin-page own-profile-page">
    <PageHeaderV2 title={t(language, "myProfile")} description={profileT("profileDescription")} />
    <WorkspaceTabs tabs={tabs} defaultTab="personal" ariaLabel={profileT("profileTabs")} />
    {selected === "personal" ? <SurfaceCard major><dl className="detail-grid own-profile-grid">
      <div><dt>{profileT("fullName")}</dt><dd className="bidi-isolate">{user?.full_name ?? "Pearlix"}</dd></div>
      <div><dt>{profileT("email")}</dt><dd><bdi>{user?.email ?? ""}</bdi></dd></div>
      <div><dt>{profileT("role")}</dt><dd>{roleT(language, role)}</dd></div>
      <div><dt>{profileT("currentLanguage")}</dt><dd>{languageLabel}</dd></div>
      <div><dt>{profileT("currentTheme")}</dt><dd>{themeLabel}</dd></div>
      <div><dt>{profileT("passwordChangeState")}</dt><dd>{user?.must_change_password ? profileT("passwordChangeRequired") : profileT("passwordCurrent")}</dd></div>
      {user?.operational_status ? <div><dt>{featureT(language, "operationalStatus")}</dt><dd>{user.operational_status === "SETUP_REQUIRED" ? featureT(language, "setupRequired") : user.operational_status}</dd></div> : null}
    </dl>{user?.operational_status === "SETUP_REQUIRED" ? <p>{featureT(language, "scheduleRequiredHelp")}</p> : null}</SurfaceCard> : null}
    {selected === "schedule" && role !== "ADMIN" ? <OwnSchedulePage embedded /> : null}
    {selected === "leave" && role !== "ADMIN" ? <OwnLeavePage embedded /> : null}
    {selected === "security" ? <SurfaceCard major><h3>{profileT("security")}</h3><p>{profileT("securityDescription")}</p><ChangePasswordForm onSuccess={() => undefined} /></SurfaceCard> : null}
  </div>;
}
