import { describe, expect, it } from "vitest";

import { effectiveAccessForRole } from "./effectiveAccess";

describe("effectiveAccessForRole", () => {
  it("summarizes the Admin backend role without per-user overrides", () => {
    expect(effectiveAccessForRole("ADMIN")).toEqual(expect.arrayContaining([
      { category: "USERS_ACCESS", level: "MANAGE" },
      { category: "TEAM", level: "MANAGE" },
      { category: "PATIENTS", level: "READ_ONLY" },
      { category: "AUDIT_LOGS", level: "READ_ONLY" },
    ]));
  });

  it("summarizes the Staff operational role", () => {
    expect(effectiveAccessForRole("STAFF")).toEqual(expect.arrayContaining([
      { category: "PATIENTS", level: "MANAGE" },
      { category: "APPOINTMENTS", level: "MANAGE" },
      { category: "TEAM", level: "READ_ONLY" },
      { category: "USERS_ACCESS", level: "NO_ACCESS" },
    ]));
  });

  it("summarizes the Doctor's own-record scope", () => {
    expect(effectiveAccessForRole("DOCTOR")).toEqual(expect.arrayContaining([
      { category: "PATIENTS", level: "OWN_RECORDS" },
      { category: "CLINICAL_VISITS", level: "OWN_RECORDS" },
      { category: "XRAYS_AI", level: "OWN_RECORDS" },
      { category: "PAYMENTS", level: "NO_ACCESS" },
    ]));
  });
});
