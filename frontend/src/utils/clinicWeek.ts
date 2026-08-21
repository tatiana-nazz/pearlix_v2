import type { ClinicWeekday } from "../types/clinic";

export const clinicWeekdays: ClinicWeekday[] = [0, 1, 2, 3, 4, 5, 6];

export const clinicWeekdayLabels = {
  EN: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
  AR: ["الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت", "الأحد"],
} as const;

export function clinicWeekdayFromDate(date: string): ClinicWeekday {
  const sundayFirst = new Date(`${date}T12:00:00Z`).getUTCDay();
  return ((sundayFirst + 6) % 7) as ClinicWeekday;
}

export function isClinicClosedDate(date: string, weeklyClosedDays: readonly number[]): boolean {
  return weeklyClosedDays.includes(clinicWeekdayFromDate(date));
}

export function isCurrentPolicyClinicClosedDate(
  date: string,
  currentDate: string,
  weeklyClosedDays: readonly number[],
): boolean {
  return date >= currentDate && isClinicClosedDate(date, weeklyClosedDays);
}

export function normalizeWeeklyClosedDays(days: readonly number[]): ClinicWeekday[] {
  return [...new Set(days)]
    .filter((day): day is ClinicWeekday => Number.isInteger(day) && day >= 0 && day <= 6)
    .sort((a, b) => a - b);
}
