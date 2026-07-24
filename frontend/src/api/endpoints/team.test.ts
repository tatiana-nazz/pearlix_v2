import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "../http";
import { teamApi, teamQueryKeys } from "./team";

describe("teamApi", () => {
  afterEach(() => vi.restoreAllMocks());
  it("uses the Team and explicit account-linkage endpoints", async () => {
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

  it("keeps Doctor and Staff onboarding profile payloads mutually exclusive", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({} as never);
    await teamApi.create({ account: { full_name: "Dr Team", email: "doctor@example.test", temporary_password: "StrongPassword!1" }, role: "DOCTOR", doctor_profile: { specialty: "General", phone: "1", bio: "" } });
    await teamApi.create({ account: { full_name: "Staff Team", email: "staff@example.test", temporary_password: "StrongPassword!1" }, role: "STAFF", staff_profile: { position: "Reception", phone: "2" } });
    expect(post).toHaveBeenNthCalledWith(1, "/team-members/", { account: { full_name: "Dr Team", email: "doctor@example.test", temporary_password: "StrongPassword!1" }, role: "DOCTOR", doctor_profile: { specialty: "General", phone: "1", bio: "" } });
    expect(post).toHaveBeenNthCalledWith(2, "/team-members/", { account: { full_name: "Staff Team", email: "staff@example.test", temporary_password: "StrongPassword!1" }, role: "STAFF", staff_profile: { position: "Reception", phone: "2" } });
  });
});
