import { describe, expect, it } from "vitest";

import { buildAppointmentFilters } from "./appointmentFilters";
import { addDays, addMonths, calendarPeriodLabel } from "./appointmentDates";

describe("buildAppointmentFilters", () => {
  it("uses date for day view", () => {
    expect(buildAppointmentFilters({ role: "STAFF", view: "day", date: "2026-07-10" })).toMatchObject({
      date: "2026-07-10",
    });
  });

  it("turns needs reschedule into a status worklist", () => {
    expect(buildAppointmentFilters({ role: "ADMIN", view: "needs-reschedule", date: "2026-07-10", status: "UPCOMING" })).toEqual({
      status: "NEEDS_RESCHEDULE",
    });
  });

  it("keeps only supported backend query params", () => {
    expect(buildAppointmentFilters({ role: "STAFF", view: "list", date: "2026-07-10", doctorId: 7, page: 2, status: "CHECKED_IN" })).toEqual({
      page: 2,
      doctor_id: 7,
      status: "CHECKED_IN",
      start_from: "2026-07-10T00:00:00",
      start_to: "2026-07-11T00:00:00",
    });
  });
});

describe("calendar period utilities", () => {
  it("moves days, weeks, and months using clinic-local calendar dates", () => {
    expect(addDays("2026-07-10", -1)).toBe("2026-07-09");
    expect(addDays("2026-07-10", 7)).toBe("2026-07-17");
    expect(addMonths("2026-01-10", -1)).toBe("2025-12-10");
    expect(calendarPeriodLabel("2026-07-10", "week", "en")).toContain("Jul");
  });
});
