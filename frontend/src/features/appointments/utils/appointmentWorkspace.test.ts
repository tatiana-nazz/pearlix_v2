import { describe, expect, it } from "vitest";

import { appointmentCopy, appointmentStatusLabel } from "../i18n";
import { getMonthGrid, getWeekRange, isValidDateInput } from "./appointmentDates";
import { buildAppointmentFilters } from "./appointmentFilters";

describe("appointment workspace URL and locale helpers", () => {
  it("uses week and month bounds without raw date parsing failures", () => {
    expect(getWeekRange("2026-07-22")).toEqual({ start: "2026-07-20", end: "2026-07-26" });
    expect(getMonthGrid("2026-07-22")).toContain("2026-07-31");
    expect(isValidDateInput("invalid")).toBe(false);
  });

  it("keeps list search server-backed and needs-reschedule status explicit", () => {
    expect(buildAppointmentFilters({ role: "STAFF", view: "list", date: "2026-07-22", search: "Maya" }).search).toBe("Maya");
    expect(buildAppointmentFilters({ role: "STAFF", view: "needs-reschedule", date: "2026-07-22", status: "UPCOMING" }).status).toBe("NEEDS_RESCHEDULE");
  });

  it("localizes representative Arabic workspace copy and statuses", () => {
    expect(appointmentCopy("AR").needsReschedule).toBe("تحتاج إلى إعادة جدولة");
    expect(appointmentStatusLabel("AR", "CHECKED_IN")).toBe("تم تسجيل الحضور");
  });
});
