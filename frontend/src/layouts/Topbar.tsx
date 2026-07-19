import { Languages, Menu, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

import { useAuthStore } from "../auth/authStore";
import type { LanguagePreference, ThemePreference } from "../types/auth";
import { roleT, t } from "./i18n";

export function Topbar({ onMenu }: { onMenu: (trigger: HTMLElement) => void }) {
  const { user, role, updatePreferences } = useAuthStore();
  const language = user?.language_preference ?? "EN";
  const preference = user?.theme_preference ?? "SYSTEM";
  const [systemDark, setSystemDark] = useState(() => typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const effectiveTheme = preference === "SYSTEM" ? (systemDark ? "dark" : "light") : preference.toLowerCase();

  useEffect(() => { if (typeof window.matchMedia !== "function") return; const query = window.matchMedia("(prefers-color-scheme: dark)"); const listener = (event: MediaQueryListEvent) => setSystemDark(event.matches); query.addEventListener?.("change", listener); return () => query.removeEventListener?.("change", listener); }, []);
  useEffect(() => { document.documentElement.dataset.theme = effectiveTheme; document.documentElement.lang = language === "AR" ? "ar" : "en"; document.documentElement.dir = language === "AR" ? "rtl" : "ltr"; }, [effectiveTheme, language]);

  async function setTheme(theme: ThemePreference) { try { await updatePreferences({ theme_preference: theme }); } catch { /* state restores in the store; server errors must not corrupt auth. */ } }
  async function setLanguage(next: LanguagePreference) { try { await updatePreferences({ language_preference: next }); } catch { /* state restores in the store. */ } }

  return (
    <header className="workspace-header">
      <div className="workspace-header-identity">
        <button className="v2-icon-button mobile-nav-trigger" type="button" aria-label={t(language, "menu")} data-tooltip={t(language, "menu")} onClick={(event) => onMenu(event.currentTarget)}><Menu size={20} /></button>
        <div className="current-user-identity">
          <strong className="bidi-isolate">{user?.full_name ?? "Pearlix"}</strong>
          <span>{roleT(language, role)}</span>
        </div>
      </div>
      <div className="workspace-header-utilities">
        <button className="v2-icon-button theme-toggle" type="button" aria-label={effectiveTheme === "dark" ? t(language, "switchToLightMode") : t(language, "switchToDarkMode")} data-tooltip={preference === "SYSTEM" ? t(language, effectiveTheme === "dark" ? "systemDark" : "systemLight") : effectiveTheme === "dark" ? t(language, "switchToLightMode") : t(language, "switchToDarkMode")} aria-pressed={effectiveTheme === "dark"} onClick={() => setTheme(effectiveTheme === "dark" ? "LIGHT" : "DARK")}>{effectiveTheme === "dark" ? <Moon size={18} aria-hidden="true" /> : <Sun size={18} aria-hidden="true" />}</button>
        <button className="v2-icon-button language-toggle" type="button" aria-label={t(language, "languageToggle")} data-tooltip={t(language, "languageToggle")} onClick={() => setLanguage(language === "EN" ? "AR" : "EN")}><Languages size={18} aria-hidden="true" /><span className="language-indicator" aria-hidden="true">{language}</span></button>
      </div>
    </header>
  );
}
