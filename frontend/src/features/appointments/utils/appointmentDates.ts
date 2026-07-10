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

export function addDays(value: string, days: number): string {
  const date = localDate(new Date(`${value}T00:00:00`));
  date.setDate(date.getDate() + days);
  return toDateInputValue(date);
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
