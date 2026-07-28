import { describe, expect, it } from "vitest";

import { normalizeScheduleSummary } from "./team";

describe("Team directory schedule normalization", () => {
  it("preserves active schedule facts and a zero active-shift count", () => {
    expect(normalizeScheduleSummary({ has_active_schedule: true, active_shift_count: 2 })).toEqual({ has_active_schedule: true, active_shift_count: 2 });
    expect(normalizeScheduleSummary({ has_active_schedule: false, active_shift_count: 0 })).toEqual({ has_active_schedule: false, active_shift_count: 0 });
  });

  it("converts missing or malformed optional schedule data into a safe setup-required state", () => {
    expect(normalizeScheduleSummary(undefined)).toEqual({ has_active_schedule: false, active_shift_count: 0 });
    expect(normalizeScheduleSummary({ has_active_schedule: "yes", active_shift_count: -1 })).toEqual({ has_active_schedule: false, active_shift_count: 0 });
  });
});
