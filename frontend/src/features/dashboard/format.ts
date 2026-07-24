import type { LanguagePreference } from "../../types/auth";

function locale(language: LanguagePreference) { return language === "AR" ? "ar" : "en-US"; }

export function dashboardDate(value: string, language: LanguagePreference, timeZone: string): string {
  return new Intl.DateTimeFormat(locale(language), { dateStyle: "full", timeZone }).format(new Date(`${value}T12:00:00Z`));
}

export function dashboardTime(value: string, language: LanguagePreference, timeZone: string): string {
  return new Intl.DateTimeFormat(locale(language), { hour: "numeric", minute: "2-digit", timeZone }).format(new Date(value));
}
