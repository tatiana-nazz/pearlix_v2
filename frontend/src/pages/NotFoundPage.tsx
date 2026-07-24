import { Link } from "react-router-dom";
import { MapPinOff } from "lucide-react";

import { useAuthStore } from "../auth/authStore";
import { t } from "../layouts/i18n";

export function NotFoundPage() {
  const language = useAuthStore((state) => state.user?.language_preference ?? "EN");
  return (
    <main className="supporting-state-page" lang={language === "AR" ? "ar" : "en"} dir={language === "AR" ? "rtl" : "ltr"}>
      <section className="supporting-state-card">
        <span className="supporting-state-icon" aria-hidden="true"><MapPinOff size={28} /></span>
        <p className="eyebrow">{t(language, "notFound")}</p>
        <h1>{t(language, "notFoundTitle")}</h1>
        <p>{t(language, "notFoundDescription")}</p>
        <Link className="v2-button secondary" to="/">
          {t(language, "returnHome")}
        </Link>
      </section>
    </main>
  );
}
