import { describe, expect, it, vi } from "vitest";

import { api } from "../http";
import { auditApi } from "./audit";

describe("auditApi read-only contract", () => {
  it("uses GET for the list and detail endpoints", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValue({} as never);
    await auditApi.list({ actor_id: "7", action: "patient_created" });
    await auditApi.detail(9);
    expect(get).toHaveBeenNthCalledWith(1, "/audit-logs/", { actor_id: "7", action: "patient_created" });
    expect(get).toHaveBeenNthCalledWith(2, "/audit-logs/9/");
  });

  it("exposes no mutation operations", () => {
    expect(Object.keys(auditApi).sort()).toEqual(["detail", "list"]);
  });
});
