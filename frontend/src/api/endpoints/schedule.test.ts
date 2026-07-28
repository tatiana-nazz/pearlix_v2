import { beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "../http";
import { scheduleApi } from "./schedule";

describe("scheduleApi", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("uses versioned action endpoints and never DELETE for shifts or leave", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({} as never);
    const remove = vi.spyOn(api, "delete").mockResolvedValue({} as never);
    await scheduleApi.setDefaultShiftActive(7, 3, false);
    await scheduleApi.setWorkingShiftActive(8, 4, true, true);
    await scheduleApi.cancelAvailabilityException(9, 5);
    expect(post).toHaveBeenNthCalledWith(1, "/clinic-default-shifts/7/deactivate/", { version: 3 });
    expect(post).toHaveBeenNthCalledWith(2, "/working-shifts/8/activate/", { version: 4, confirm_appointment_impact: true });
    expect(post).toHaveBeenNthCalledWith(3, "/availability-exceptions/9/cancel/", { version: 5 });
    expect(remove).not.toHaveBeenCalled();
  });

  it("sends explicit apply and copy modes with appointment-impact confirmation", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({} as never);
    await scheduleApi.applyDefault(3, "MISSING_ONLY");
    await scheduleApi.applyDefault(3, "REPLACE_ALL", true);
    await scheduleApi.copySchedule(2, 3, "REPLACE_ALL", true);
    expect(post).toHaveBeenNthCalledWith(1, "/working-shifts/apply-default/", { employee_id: 3, mode: "MISSING_ONLY", confirm_appointment_impact: false });
    expect(post).toHaveBeenNthCalledWith(2, "/working-shifts/apply-default/", { employee_id: 3, mode: "REPLACE_ALL", confirm_appointment_impact: true });
    expect(post).toHaveBeenNthCalledWith(3, "/working-shifts/copy-schedule/", { source_employee_id: 2, target_employee_id: 3, mode: "REPLACE_ALL", confirm_appointment_impact: true });
  });

  it("keeps appointment status out of all schedule payloads", async () => {
    const patch = vi.spyOn(api, "patch").mockResolvedValue({} as never);
    await scheduleApi.updateWorkingShift(4, { name: "Evening", version: 2 });
    expect(patch).toHaveBeenCalledWith("/working-shifts/4/", { name: "Evening", version: 2 });
    expect(patch.mock.calls[0][1]).not.toHaveProperty("status");
  });

  it("loads a leave detail through the production retrieve endpoint", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValue({} as never);
    await scheduleApi.availabilityException(14);
    expect(get).toHaveBeenCalledWith("/availability-exceptions/14/");
  });
});
