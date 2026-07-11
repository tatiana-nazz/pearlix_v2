import { describe, expect, it } from "vitest";

import type { VisitDetail } from "../../../types/visits";
import { getVisitPermissions } from "./visitPermissions";

const visit = { id: 3, doctor: { id: 12 }, status: "ACTIVE" } as VisitDetail;

describe("getVisitPermissions", () => {
  it("allows only the owning doctor to edit and complete an active visit", () => {
    expect(getVisitPermissions("DOCTOR", 12, visit)).toMatchObject({
      canEditClinicalNotes: true,
      canCompleteVisit: true,
    });
    expect(getVisitPermissions("DOCTOR", 13, visit)).toMatchObject({
      canEditClinicalNotes: false,
      canCompleteVisit: false,
    });
  });

  it("keeps completed own visits editable without allowing a second completion", () => {
    expect(getVisitPermissions("DOCTOR", 12, { ...visit, status: "COMPLETED" })).toMatchObject({
      canEditClinicalNotes: true,
      canCompleteVisit: false,
    });
  });

  it("keeps staff and admin clinical views read-only", () => {
    expect(getVisitPermissions("STAFF", 12, visit).canEditClinicalNotes).toBe(false);
    expect(getVisitPermissions("ADMIN", 12, visit).canEditClinicalNotes).toBe(false);
  });
});
