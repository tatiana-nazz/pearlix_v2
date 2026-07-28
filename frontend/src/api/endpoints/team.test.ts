import { describe, expect, it, vi } from "vitest";

import { api } from "../http";
import { teamApi, teamQueryKeys } from "./team";

describe("teamApi", () => {
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

  it("keeps Doctor and Staff onboarding transactional and profile-specific", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({} as never);
    await teamApi.create({ account: { full_name: "Dr Noor", email: "noor@example.test", temporary_password: "Temporary123" }, role: "DOCTOR", doctor_profile: { specialty: "Endodontics", phone: "555", bio: "" } });
    await teamApi.create({ account: { full_name: "Hana", email: "hana@example.test", temporary_password: "Temporary123" }, role: "STAFF", staff_profile: { position: "Reception", phone: "556" } });
    expect(post).toHaveBeenNthCalledWith(1, "/team-members/", expect.objectContaining({ role: "DOCTOR", doctor_profile: expect.any(Object) }));
    expect(post.mock.calls[0][1]).not.toHaveProperty("staff_profile");
    expect(post).toHaveBeenNthCalledWith(2, "/team-members/", expect.objectContaining({ role: "STAFF", staff_profile: expect.any(Object) }));
    expect(post.mock.calls[1][1]).not.toHaveProperty("doctor_profile");
  });
});
