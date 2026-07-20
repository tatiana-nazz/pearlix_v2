import { Link } from "react-router-dom";

import { useAuthStore } from "../../auth/authStore";
import { PageHeaderV2, SurfaceCard } from "../../components/v2";
import { featureT, roleT, t } from "../../layouts/i18n";

export function OwnProfilePage() {
  const user = useAuthStore((state) => state.user);
  const role = useAuthStore((state) => state.role);
  const language = user?.language_preference ?? "EN";
  const profileT = (key: "profileDescription" | "fullName" | "email" | "role" | "currentLanguage" | "currentTheme" | "passwordChangeState" | "passwordChangeRequired" | "passwordCurrent" | "changePassword") => featureT(language, key);
  const languageLabel = user?.language_preference === "AR" ? "\u0627\u0644\u0639\u0631\u0628\u064a\u0629" : "English";
  const themeLabel = user?.theme_preference === "LIGHT" ? t(language, "light") : user?.theme_preference === "DARK" ? t(language, "dark") : t(language, "system");

  return <div className="admin-page own-profile-page">
    <PageHeaderV2 title={t(language, "myProfile")} description={profileT("profileDescription")} />
    <SurfaceCard major>
      <dl className="detail-grid own-profile-grid">
        <div><dt>{profileT("fullName")}</dt><dd className="bidi-isolate">{user?.full_name ?? "Pearlix"}</dd></div>
        <div><dt>{profileT("email")}</dt><dd><bdi>{user?.email ?? ""}</bdi></dd></div>
        <div><dt>{profileT("role")}</dt><dd>{roleT(language, role)}</dd></div>
        <div><dt>{profileT("currentLanguage")}</dt><dd>{languageLabel}</dd></div>
        <div><dt>{profileT("currentTheme")}</dt><dd>{themeLabel}</dd></div>
        <div><dt>{profileT("passwordChangeState")}</dt><dd>{user?.must_change_password ? profileT("passwordChangeRequired") : profileT("passwordCurrent")}</dd></div>
        {user?.operational_status ? <div><dt>{featureT(language, "operationalStatus")}</dt><dd>{user.operational_status === "SETUP_REQUIRED" ? featureT(language, "setupRequired") : user.operational_status}</dd></div> : null}
      </dl>
      {user?.operational_status === "SETUP_REQUIRED" ? <p>{featureT(language, "scheduleRequiredHelp")}</p> : null}
      <div className="own-profile-actions"><Link className="v2-button secondary" to="/change-password" state={{ from: `/${role?.toLowerCase() ?? ""}/profile` }}>{profileT("changePassword")}</Link></div>
    </SurfaceCard>
  </div>;
}
