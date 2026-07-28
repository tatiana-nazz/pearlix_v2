import { describe, expect, it, vi } from "vitest";

import { api } from "../http";
import { usersApi } from "./users";

describe("usersApi security actions", () => {
  it("creates an account-only Admin payload through the users endpoint", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({} as never);
    await usersApi.create({ full_name: "Clinic Admin", email: "admin@example.test", role: "ADMIN", temporary_password: "Temporary123" });
    expect(post).toHaveBeenCalledWith("/users/", expect.objectContaining({ role: "ADMIN", temporary_password: "Temporary123" }));
  });

  it("uses the separate temporary password reset action", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({} as never);
    await usersApi.resetPassword(7, { temporary_password: "Temporary123" });
    expect(post).toHaveBeenCalledWith("/users/7/reset-password/", { temporary_password: "Temporary123" });
  });

  it("uses a separate deactivation action with no role mutation payload", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({} as never);
    await usersApi.deactivate(7);
    expect(post).toHaveBeenCalledWith("/users/7/deactivate/");
  });

  it("reactivates through its supported no-body action", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({} as never);
    await usersApi.reactivate(7);
    expect(post).toHaveBeenCalledWith("/users/7/reactivate/");
  });
});
