import { describe, expect, it } from "vitest";
import { appointmentRecordClass, appointmentStatusAppearance } from "./appointmentStatusAppearance";

describe("appointment status appearance", () => {
  it("maps every known backend status to a whole-record tone", () => {
    expect(Object.keys(appointmentStatusAppearance)).toEqual(["UPCOMING", "CHECKED_IN", "ACTIVE", "COMPLETED", "NEEDS_RESCHEDULE", "CANCELLED", "NO_SHOW"]);
    expect(Object.values(appointmentStatusAppearance)).not.toContain("neutral");
  });

  it("uses a safe neutral treatment for an unknown status", () => {
    expect(appointmentRecordClass("FUTURE_STATUS")).toBe("appointment-record appointment-record--neutral");
  });
});
