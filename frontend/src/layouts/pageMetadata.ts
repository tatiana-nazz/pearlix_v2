import type { LanguagePreference } from "../types/auth";

const titles: Array<{ match: RegExp; en: string; ar: string }> = [
  { match: /\/dashboard$/, en: "Dashboard", ar: "\u0644\u0648\u062d\u0629 \u0627\u0644\u062a\u062d\u0643\u0645" },
  { match: /\/appointments\/day$/, en: "Day Appointments", ar: "\u0645\u0648\u0627\u0639\u064a\u062f \u0627\u0644\u064a\u0648\u0645" },
  { match: /\/appointments\/(week|month|list|needs-reschedule)$/, en: "Appointments", ar: "\u0627\u0644\u0645\u0648\u0627\u0639\u064a\u062f" },
  { match: /\/doctors$/, en: "Schedules and Leave", ar: "\u0627\u0644\u062c\u062f\u0627\u0648\u0644 \u0648\u0627\u0644\u0625\u062c\u0627\u0632\u0627\u062a" },
  { match: /\/patients/, en: "Patients", ar: "\u0627\u0644\u0645\u0631\u0636\u0649" }, { match: /\/xrays/, en: "X-rays and AI", ar: "\u0627\u0644\u0623\u0634\u0639\u0629 \u0648\u0627\u0644\u0630\u0643\u0627\u0621" },
  { match: /\/billing/, en: "Billing", ar: "\u0627\u0644\u0641\u0648\u062a\u0631\u0629" }, { match: /\/users/, en: "Users and Access", ar: "\u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645\u0648\u0646 \u0648\u0627\u0644\u0635\u0644\u0627\u062d\u064a\u0627\u062a" },
  { match: /\/clinic-settings$/, en: "Clinic Settings", ar: "\u0625\u0639\u062f\u0627\u062f\u0627\u062a \u0627\u0644\u0639\u064a\u0627\u062f\u0629" }, { match: /\/audit-logs/, en: "Audit Logs", ar: "\u0633\u062c\u0644\u0627\u062a \u0627\u0644\u062a\u062f\u0642\u064a\u0642" },
];
export function pageTitle(pathname: string, language: LanguagePreference) { const item = titles.find(({ match }) => match.test(pathname)); return item ? (language === "AR" ? item.ar : item.en) : "Pearlix"; }
