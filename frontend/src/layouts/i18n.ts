import type { LanguagePreference } from "../types/auth";

const messages = {
  EN: { menu: "Open navigation", theme: "Theme", language: "Language", light: "Light", dark: "Dark", system: "System", logout: "Logout", schedule: "My schedule", leave: "My leave", workspace: "Workspace", clinical: "Clinical operations", administration: "Administration", personal: "Personal", close: "Close navigation" },
  AR: { menu: "فتح التنقل", theme: "السمة", language: "اللغة", light: "فاتح", dark: "داكن", system: "النظام", logout: "تسجيل الخروج", schedule: "جدولي", leave: "إجازاتي", workspace: "مساحة العمل", clinical: "العمليات السريرية", administration: "الإدارة", personal: "شخصي", close: "إغلاق التنقل" },
} as const;

export function t(language: LanguagePreference, key: keyof typeof messages.EN) { return messages[language][key]; }
