import { Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";

import { useAuthStore } from "../auth/authStore";
import { t } from "../layouts/i18n";
import { dashboardPathForRole } from "../utils/roles";

export function AccessDeniedPage() {
  const role = useAuthStore((state) => state.role);
  const language = useAuthStore((state) => state.user?.language_preference ?? "EN");

  return (
    <main className="supporting-state-page" lang={language === "AR" ? "ar" : "en"} dir={language === "AR" ? "rtl" : "ltr"}>
      <section className="supporting-state-card">
        <span className="supporting-state-icon" aria-hidden="true"><ShieldAlert size={28} /></span>
        <p className="eyebrow">{t(language, "accessDenied")}</p>
        <h1>{t(language, "accessDeniedTitle")}</h1>
        <p>{t(language, "accessDeniedDescription")}</p>
        <Link className="v2-button" to={dashboardPathForRole(role)}>
          {t(language, "returnDashboard")}
        </Link>
      </section>
    </main>
  );
}
