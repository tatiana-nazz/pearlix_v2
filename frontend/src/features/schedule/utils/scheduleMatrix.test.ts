import { describe, expect, it } from "vitest";

import { buildScheduleMatrix, scheduleSummaryText } from "./scheduleMatrix";

describe("schedule matrix", () => {
  it("renders one row per chronological daily shift slot with ordinal labels", () => {
    const shifts = [
      { id: 1, name: "[DEMO] Rana Monday", weekday: 0, start_time: "08:30:00", end_time: "17:30:00", is_active: true },
      { id: 2, name: "Night", weekday: 0, start_time: "18:00:00", end_time: "22:00:00", is_active: true },
      { id: 3, name: "[DEMO] Rana Tuesday", weekday: 1, start_time: "08:30:00", end_time: "17:30:00", is_active: true },
      { id: 4, name: "[DEMO] Rana Wednesday", weekday: 2, start_time: "08:30:00", end_time: "17:30:00", is_active: true },
      { id: 5, name: "Ignored", weekday: 1, start_time: "22:00:00", end_time: "23:00:00", is_active: false },
    ];

    const rows = buildScheduleMatrix(shifts);
    expect(rows.map((row) => row.label)).toEqual(["Shift 1", "Shift 2"]);
    expect(rows[0].days).toHaveLength(7);
    expect(rows[0].days[0]).toEqual([{ start: "08:30:00", end: "17:30:00" }]);
    expect(rows[0].days[1]).toEqual([{ start: "08:30:00", end: "17:30:00" }]);
    expect(rows[1].days[0]).toEqual([{ start: "18:00:00", end: "22:00:00" }]);
    expect(rows[1].days[1]).toEqual([]);
  });

  it("ignores stored semantic names and always labels rows Shift 1, Shift 2, Shift 3", () => {
    const rows = buildScheduleMatrix([
      { id: 1, name: "Morning", weekday: 0, start_time: "08:00:00", end_time: "12:00:00", is_active: true },
      { id: 2, name: "Morning", weekday: 1, start_time: "09:00:00", end_time: "13:00:00", is_active: true },
      { id: 3, name: "Evening", weekday: 0, start_time: "16:00:00", end_time: "20:00:00", is_active: true },
      { id: 4, name: "Night", weekday: 0, start_time: "21:00:00", end_time: "23:00:00", is_active: true },
    ]);

    expect(rows.map((row) => row.label)).toEqual(["Shift 1", "Shift 2", "Shift 3"]);
    expect(rows[0].days[1][0].start).toBe("09:00:00");
    expect(rows[2].days[0][0].start).toBe("21:00:00");
  });

  it("creates a concise localized schedule summary", () => {
    const shifts = [
      { id: 1, name: "Morning", weekday: 0, start_time: "08:00:00", end_time: "09:00:00", is_active: true },
      { id: 2, name: "Evening", weekday: 0, start_time: "16:00:00", end_time: "20:00:00", is_active: true },
    ];
    expect(scheduleSummaryText(shifts, "EN")).toBe("Mon · 08:00–09:00, 16:00–20:00");
    expect(scheduleSummaryText([], "EN")).toBe("No active schedule");
  });

  it("summarizes the first effective open shift instead of a suppressed clinic-closed shift", () => {
    const shifts = [
      { id: 1, name: "Friday", weekday: 4, start_time: "08:00:00", end_time: "12:00:00", is_active: true },
      { id: 2, name: "Sunday", weekday: 6, start_time: "09:00:00", end_time: "13:00:00", is_active: true },
    ];
    expect(scheduleSummaryText(shifts, "EN", [4])).toBe("Sun · 09:00–13:00");
    expect(scheduleSummaryText([shifts[0]], "EN", [4])).toBe("Clinic closed on stored shift days");
  });
});
