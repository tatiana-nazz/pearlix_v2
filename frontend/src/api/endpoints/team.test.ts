import { describe, expect, it, vi } from "vitest";

import { api } from "../http";
import { teamApi, teamQueryKeys } from "./team";

describe("teamApi", () => {
  it("uses the Team and explicit account-linkage endpoints without exposing a runtime route", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({} as never);
    const patch = vi.spyOn(api, "patch").mockResolvedValue({} as never);
    await teamApi.setProfessionalStatus(7, { is_active: false, version: 2, reason: "Leave" });
    await teamApi.previewRoleTransition(8, "DOCTOR");
    await teamApi.confirmRoleTransition(8, { target_role: "DOCTOR", mode: "CONFIRM", confirmation_token: "signed", profile: { specialty: "Endodontics" }, version: 3 });
    await teamApi.update(7, { version: 2, specialty: "Endodontics" });
    expect(post).toHaveBeenNthCalledWith(1, "/team-members/7/set-professional-status/", { is_active: false, version: 2, reason: "Leave" });
    expect(post).toHaveBeenNthCalledWith(2, "/users/8/transition-role/", { target_role: "DOCTOR", mode: "PREVIEW" });
    expect(post).toHaveBeenNthCalledWith(3, "/users/8/transition-role/", { target_role: "DOCTOR", mode: "CONFIRM", confirmation_token: "signed", profile: { specialty: "Endodontics" }, version: 3 });
    expect(patch).toHaveBeenCalledWith("/team-members/7/", { version: 2, specialty: "Endodontics" });
    expect(teamQueryKeys.detail(7)).toEqual(["team-members", 7]);
  });
});
