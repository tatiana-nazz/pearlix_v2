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

function rowLabel(shifts: Array<ScheduleShiftLike | undefined>, rowIndex: number) {
  const named = shifts
    .map((shift) => shift?.name.trim() ?? "")
    .filter(Boolean);
  if (named.length) {
    const identity = normalizedIdentity(named[0]);
    if (named.every((name) => normalizedIdentity(name) === identity)) return named[0];
  }
  return `Shift ${rowIndex + 1}`;
}

export function buildScheduleMatrix(shifts: ScheduleShiftLike[]): ScheduleMatrixRow[] {
  const byDay: ScheduleShiftLike[][] = Array.from({ length: 7 }, () => []);
  shifts
    .filter((shift) => shift.is_active !== false && shift.weekday >= 0 && shift.weekday <= 6)
    .forEach((shift) => byDay[shift.weekday].push(shift));

  byDay.forEach((day) => day.sort(
    (a, b) => a.start_time.localeCompare(b.start_time)
      || a.end_time.localeCompare(b.end_time)
      || a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }),
  ));

  const rowCount = Math.max(0, ...byDay.map((day) => day.length));
  return Array.from({ length: rowCount }, (_, rowIndex) => {
    const slotShifts = byDay.map((day) => day[rowIndex]);
    return {
      id: `shift-slot-${rowIndex + 1}`,
      label: rowLabel(slotShifts, rowIndex),
      days: slotShifts.map((shift) => shift ? [{ start: shift.start_time, end: shift.end_time }] : []),
    };
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
