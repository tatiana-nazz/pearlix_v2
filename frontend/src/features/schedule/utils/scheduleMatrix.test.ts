import { describe, expect, it } from "vitest";

import { buildScheduleMatrix, scheduleSummaryText } from "./scheduleMatrix";

describe("schedule matrix", () => {
  const shifts = [
    { id: 1, name: "Morning", weekday: 0, start_time: "10:00:00", end_time: "12:00:00", is_active: true },
    { id: 2, name: " morning ", weekday: 0, start_time: "08:00:00", end_time: "09:00:00", is_active: true },
    { id: 3, name: "Evening", weekday: 2, start_time: "16:00:00", end_time: "19:00:00", is_active: true },
    { id: 4, name: "Ignored", weekday: 1, start_time: "09:00:00", end_time: "10:00:00", is_active: false },
  ];

  it("groups normalized names, retains seven days, and sorts ranges and rows", () => {
    const rows = buildScheduleMatrix(shifts);
    expect(rows.map((row) => row.label)).toEqual(["Morning", "Evening"]);
    expect(rows[0].days).toHaveLength(7);
    expect(rows[0].days[0].map((range) => range.start)).toEqual(["08:00:00", "10:00:00"]);
    expect(rows[0].days[1]).toEqual([]);
  });

  it("creates a concise localized schedule summary", () => {
    expect(scheduleSummaryText(shifts, "EN")).toBe("Mon · 08:00–09:00, 10:00–12:00");
    expect(scheduleSummaryText([], "EN")).toBe("No active schedule");
  });
});
