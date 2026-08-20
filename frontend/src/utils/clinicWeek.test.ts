import { describe, expect, it } from "vitest";

import { clinicWeekdayFromDate, isClinicClosedDate, normalizeWeeklyClosedDays } from "./clinicWeek";

describe("clinic operating week helpers", () => {
  it("maps ISO dates to Pearlix Monday-first weekday numbers", () => {
    expect(clinicWeekdayFromDate("2026-08-21")).toBe(4);
    expect(clinicWeekdayFromDate("2026-08-23")).toBe(6);
  });

  it("derives closure from settings rather than a Friday assumption", () => {
    expect(isClinicClosedDate("2026-08-21", [6])).toBe(false);
    expect(isClinicClosedDate("2026-08-23", [6])).toBe(true);
  });

  it("normalizes valid days deterministically for client payloads", () => {
    expect(normalizeWeeklyClosedDays([5, 4, 5, -1, 7])).toEqual([4, 5]);
  });
});
