import { describe, expect, it } from "vitest";

import { clinicWeekdayFromDate, isClinicClosedDate, isCurrentPolicyClinicClosedDate, normalizeWeeklyClosedDays } from "./clinicWeek";

describe("clinic operating week helpers", () => {
  it("maps ISO dates to Pearlix Monday-first weekday numbers", () => {
    expect(clinicWeekdayFromDate("2026-08-21")).toBe(4);
    expect(clinicWeekdayFromDate("2026-08-23")).toBe(6);
  });

  it("derives closure from settings rather than a Friday assumption", () => {
    expect(isClinicClosedDate("2026-08-21", [6])).toBe(false);
    expect(isClinicClosedDate("2026-08-23", [6])).toBe(true);
  });

  it("applies the current policy only to today and future dates", () => {
    expect(isCurrentPolicyClinicClosedDate("2026-08-14", "2026-08-21", [4])).toBe(false);
    expect(isCurrentPolicyClinicClosedDate("2026-08-21", "2026-08-21", [4])).toBe(true);
    expect(isCurrentPolicyClinicClosedDate("2026-08-28", "2026-08-21", [4])).toBe(true);
  });

  it("normalizes valid days deterministically for client payloads", () => {
    expect(normalizeWeeklyClosedDays([5, 4, 5, -1, 7])).toEqual([4, 5]);
  });
});
