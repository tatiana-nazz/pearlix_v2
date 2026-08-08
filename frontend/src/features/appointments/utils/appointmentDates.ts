import type { AppointmentViewMode } from "../../../types/appointments";

const dayMs = 24 * 60 * 60 * 1000;

function localDate(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

export function toDateInputValue(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function todayInputValue(): string {
  return toDateInputValue(new Date());
}

export function clinicToday(timezone?: string): string {
  if (!timezone) return todayInputValue();
  try {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
    const value = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
    return `${value.year}-${value.month}-${value.day}`;
  } catch {
    return todayInputValue();
  }
}

export function isValidDateInput(value: string | null): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T12:00:00`).getTime()));
}

export function formatAppointmentDate(value: string, language: "EN" | "AR", timezone?: string, options: Intl.DateTimeFormatOptions = { dateStyle: "medium" }): string {
  return new Intl.DateTimeFormat(language === "AR" ? "ar" : "en-US", { ...options, timeZone: timezone }).format(new Date(`${value}T12:00:00Z`));
}

export function formatAppointmentDateTime(value: string, language: "EN" | "AR", timezone?: string): string {
  return new Intl.DateTimeFormat(language === "AR" ? "ar" : "en-US", { dateStyle: "medium", timeStyle: "short", timeZone: timezone }).format(new Date(value));
}

export function formatAppointmentTime(value: string, language: "EN" | "AR", timezone?: string): string {
  return new Intl.DateTimeFormat(language === "AR" ? "ar" : "en-US", { hour: "numeric", minute: "2-digit", timeZone: timezone }).format(new Date(value));
}

export function addDays(value: string, days: number): string {
  const date = localDate(new Date(`${value}T00:00:00`));
  date.setDate(date.getDate() + days);
  return toDateInputValue(date);
}

export function addMonths(value: string, months: number): string {
  const current = localDate(new Date(`${value}T00:00:00`));
  const day = current.getDate();
  const target = new Date(current.getFullYear(), current.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, lastDay));
  return toDateInputValue(target);
}

export function getWeekRange(anchor: string) {
  const date = localDate(new Date(`${anchor}T00:00:00`));
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const start = new Date(date.getTime() + mondayOffset * dayMs);
  const end = new Date(start.getTime() + 6 * dayMs);
  return { start: toDateInputValue(start), end: toDateInputValue(end) };
}

export function getMonthRange(anchor: string) {
  const date = localDate(new Date(`${anchor}T00:00:00`));
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { start: toDateInputValue(start), end: toDateInputValue(end) };
}

export function getMonthGrid(anchor: string): string[] {
  const range = getMonthRange(anchor);
  const first = localDate(new Date(`${range.start}T00:00:00`));
  const last = localDate(new Date(`${range.end}T00:00:00`));
  const firstDay = first.getDay();
  const gridStart = new Date(first.getTime() + (firstDay === 0 ? -6 : 1 - firstDay) * dayMs);
  const lastDay = last.getDay();
  const gridEnd = new Date(last.getTime() + (lastDay === 0 ? 0 : 7 - lastDay) * dayMs);
  const days: string[] = [];
  for (let current = gridStart; current <= gridEnd; current = new Date(current.getTime() + dayMs)) {
    days.push(toDateInputValue(current));
  }
  return days;
}

export function dateTimeAt(date: string, time: string): string {
  return `${date}T${time}`;
}

export function isDateInMonth(date: string, anchor: string): boolean {
  const day = new Date(`${date}T00:00:00`);
  const month = new Date(`${anchor}T00:00:00`);
  return day.getFullYear() === month.getFullYear() && day.getMonth() === month.getMonth();
}

export function viewLabel(view: AppointmentViewMode): string {
  return view
    .split("-")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}
