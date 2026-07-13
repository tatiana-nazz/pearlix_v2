import { describe, expect, it } from "vitest";

import type { AppointmentListItem } from "../../../types/appointments";
import { getAppointmentPermissions } from "./appointmentPermissions";

const appointment = (status: AppointmentListItem["status"]) => ({ id: 1, status }) as AppointmentListItem;

describe("getAppointmentPermissions", () => {
  it("keeps Admin appointment access read-only", () => {
    expect(getAppointmentPermissions("ADMIN", appointment("UPCOMING"))).toMatchObject({
      canCreate: false,
      canEdit: false,
      canCheckIn: false,
      isReadOnly: true,
    });
  });

  it("allows Staff to manage editable appointments through action endpoints", () => {
    expect(getAppointmentPermissions("STAFF", appointment("UPCOMING"))).toMatchObject({
      canCreate: true,
      canEdit: true,
      canReschedule: true,
      canCheckIn: true,
      canCancel: true,
      canNoShow: true,
    });
    expect(getAppointmentPermissions("STAFF", appointment("COMPLETED")).canEdit).toBe(false);
  });

  it("limits Doctor to starting checked-in visits", () => {
    expect(getAppointmentPermissions("DOCTOR", appointment("CHECKED_IN"))).toMatchObject({
      canStartVisit: true,
      canEdit: false,
      canCancel: false,
      isReadOnly: true,
    });
  });

  it("never exposes Start Visit for non-checked-in appointment states or non-Doctors", () => {
    for (const status of ["UPCOMING", "ACTIVE", "COMPLETED", "CANCELLED", "NO_SHOW", "NEEDS_RESCHEDULE"] as const) {
      expect(getAppointmentPermissions("DOCTOR", appointment(status)).canStartVisit).toBe(false);
    }
    expect(getAppointmentPermissions("STAFF", appointment("CHECKED_IN")).canStartVisit).toBe(false);
    expect(getAppointmentPermissions("ADMIN", appointment("CHECKED_IN")).canStartVisit).toBe(false);
  });
});
