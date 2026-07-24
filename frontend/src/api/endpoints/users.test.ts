import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "../http";
import { usersApi } from "./users";

describe("usersApi", () => {
  afterEach(() => vi.restoreAllMocks());
  it("uses dedicated account security action endpoints", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({} as never);
    await usersApi.resetPassword(4, { temporary_password: "StrongPassword!1" });
    await usersApi.deactivate(4);
    await usersApi.reactivate(4);
    expect(post).toHaveBeenNthCalledWith(1, "/users/4/reset-password/", { temporary_password: "StrongPassword!1" });
    expect(post).toHaveBeenNthCalledWith(2, "/users/4/deactivate/");
    expect(post).toHaveBeenNthCalledWith(3, "/users/4/reactivate/");
  });
});
