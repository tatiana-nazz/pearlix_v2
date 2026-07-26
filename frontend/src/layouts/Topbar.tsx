import { Languages, Menu, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuthStore } from "../auth/authStore";
import { roleLabel } from "../utils/roles";
import type { LanguagePreference, ThemePreference } from "../types/auth";
import { localizedRoleLabel, t } from "./i18n";

export function Topbar({ onMenu }: { onMenu: (trigger: HTMLElement) => void }) {
  const navigate = useNavigate();
  const { user, role, logout, updatePreferences } = useAuthStore();
  const language = user?.language_preference ?? "EN";
  const preference = user?.theme_preference ?? "SYSTEM";
  const [systemDark, setSystemDark] = useState(() => typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const effectiveTheme = preference === "SYSTEM" ? (systemDark ? "dark" : "light") : preference.toLowerCase();

  useEffect(() => { if (typeof window.matchMedia !== "function") return; const query = window.matchMedia("(prefers-color-scheme: dark)"); const listener = (event: MediaQueryListEvent) => setSystemDark(event.matches); query.addEventListener?.("change", listener); return () => query.removeEventListener?.("change", listener); }, []);
  useEffect(() => { document.documentElement.dataset.theme = effectiveTheme; document.documentElement.lang = language === "AR" ? "ar" : "en"; document.documentElement.dir = language === "AR" ? "rtl" : "ltr"; }, [effectiveTheme, language]);

  async function setTheme(theme: ThemePreference) { try { await updatePreferences({ theme_preference: theme }); } catch { /* state restores in the store; server errors must not corrupt auth. */ } }
  async function setLanguage(next: LanguagePreference) { try { await updatePreferences({ language_preference: next }); } catch { /* state restores in the store. */ } }

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <header className="workspace-header">
      <div className="workspace-header-identity">
        <button className="v2-icon-button mobile-nav-trigger" type="button" aria-label={t(language, "menu")} data-tooltip={t(language, "menu")} onClick={(event) => onMenu(event.currentTarget)}><Menu size={20} /></button>
        <div>
          <strong>{user?.full_name ?? "Pearlix"}</strong>
          <span>{role ? localizedRoleLabel(language, role) : roleLabel(role)}</span>
        </div>
      </div>
      <div className="workspace-header-utilities">
        <button className="v2-icon-button theme-toggle" type="button" aria-label={`${t(language, "theme")}: ${effectiveTheme === "dark" ? t(language, "light") : t(language, "dark")}`} data-tooltip={preference === "SYSTEM" ? `${t(language, "system")}: ${effectiveTheme === "dark" ? t(language, "dark") : t(language, "light")}` : effectiveTheme === "dark" ? t(language, "light") : t(language, "dark")} aria-pressed={effectiveTheme === "dark"} onClick={() => setTheme(effectiveTheme === "dark" ? "LIGHT" : "DARK")}>{effectiveTheme === "dark" ? <Moon size={18} aria-hidden="true" /> : <Sun size={18} aria-hidden="true" />}</button>
        <div className="shell-segment language-toggle" role="group" aria-label={t(language, "language")}><button type="button" aria-pressed={language === "EN"} onClick={() => setLanguage("EN")}>EN</button><button type="button" aria-pressed={language === "AR"} onClick={() => setLanguage("AR")}><Languages size={16} aria-hidden="true" /> AR</button></div>
        <details className="user-menu"><summary aria-label={user?.full_name ?? "Pearlix"}><span className="user-avatar" aria-hidden="true">{user?.full_name?.slice(0, 2).toUpperCase() ?? "P"}</span></summary><div className="user-menu-panel"><strong>{user?.full_name ?? "Pearlix"}</strong><span>{role ? localizedRoleLabel(language, role) : roleLabel(role)}</span>{role ? <Link to={`/${role.toLowerCase()}/profile`}>{t(language, "profile")}</Link> : null}{role === "STAFF" || role === "DOCTOR" ? <><Link to={`/${role.toLowerCase()}/profile/schedule`}>{t(language, "schedule")}</Link><Link to={`/${role.toLowerCase()}/profile/leave`}>{t(language, "leave")}</Link></> : null}<button type="button" onClick={handleLogout}>{t(language, "logout")}</button><button type="button" onClick={() => setTheme("SYSTEM")}>{t(language, "system")}</button></div></details>
      </div>
    </header>
  );
}
