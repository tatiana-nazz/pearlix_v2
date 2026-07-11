import { describe, expect, it } from "vitest";

import type { ExternalXrayCase } from "../../../types/xrays";
import { canAttachExternalXray, canManageExternalXray, canUploadPatientXray } from "./xrayPermissions";

const external = { status: "TEMPORARY", uploaded_by: { id: 7 } } as ExternalXrayCase;

describe("X-ray permissions", () => {
  it("limits saved uploads to Doctors", () => {
    expect(canUploadPatientXray("DOCTOR")).toBe(true);
    expect(canUploadPatientXray("ADMIN")).toBe(false);
    expect(canUploadPatientXray("STAFF")).toBe(false);
  });

  it("keeps external attachment Doctor-only while Admin can manage temporary cases", () => {
    expect(canManageExternalXray("ADMIN", 2, external)).toBe(true);
    expect(canAttachExternalXray("ADMIN", 2, external)).toBe(false);
    expect(canAttachExternalXray("DOCTOR", 7, external)).toBe(true);
    expect(canAttachExternalXray("DOCTOR", 8, external)).toBe(false);
  });
});
