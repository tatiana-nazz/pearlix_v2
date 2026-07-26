export interface ScheduleShiftLike {
  id?: number;
  name: string;
  weekday: number;
  start_time: string;
  end_time: string;
  is_active?: boolean;
}

export interface ScheduleRange {
  start: string;
  end: string;
}

export interface ScheduleMatrixRow {
  id: string;
  label: string;
  days: ScheduleRange[][];
}

function normalizedIdentity(name: string) {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

export function buildScheduleMatrix(shifts: ScheduleShiftLike[]): ScheduleMatrixRow[] {
  const rows = new Map<string, ScheduleMatrixRow>();
  shifts
    .filter((shift) => shift.is_active !== false && shift.weekday >= 0 && shift.weekday <= 6)
    .forEach((shift) => {
      const label = shift.name.trim() || "Shift";
      const id = normalizedIdentity(label);
      const row = rows.get(id) ?? { id, label, days: Array.from({ length: 7 }, () => []) };
      row.days[shift.weekday].push({ start: shift.start_time, end: shift.end_time });
      rows.set(id, row);
    });

  return [...rows.values()]
    .map((row) => ({ ...row, days: row.days.map((ranges) => [...ranges].sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end))) }))
    .sort((a, b) => {
      const firstA = a.days.flat()[0]?.start ?? "99:99";
      const firstB = b.days.flat()[0]?.start ?? "99:99";
      return firstA.localeCompare(firstB) || a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: "base" });
    });
}

export function scheduleSummaryText(shifts: ScheduleShiftLike[], language: "EN" | "AR") {
  const active = shifts.filter((shift) => shift.is_active !== false).sort((a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time));
  if (!active.length) return language === "AR" ? "لا يوجد دوام" : "No active schedule";
  const day = active[0].weekday;
  const dayLabels = language === "AR" ? ["الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت", "الأحد"] : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const ranges = active.filter((shift) => shift.weekday === day).map((shift) => `${shift.start_time.slice(0, 5)}–${shift.end_time.slice(0, 5)}`).join(", ");
  return `${dayLabels[day]} · ${ranges}`;
}
