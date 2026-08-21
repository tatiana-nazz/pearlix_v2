import { beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "../http";
import { clinicApi } from "./clinic";

describe("clinicApi operating week", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("sends ordered weekly closures and explicit impact confirmation to the Admin settings endpoint", async () => {
    const patch = vi.spyOn(api, "patch").mockResolvedValue({} as never);

    await clinicApi.updateSettings({ weekly_closed_days: [4, 5], confirm_appointment_impact: true });

    expect(patch).toHaveBeenCalledWith("/clinic/settings/", {
      weekly_closed_days: [4, 5],
      confirm_appointment_impact: true,
    });
  });
});
