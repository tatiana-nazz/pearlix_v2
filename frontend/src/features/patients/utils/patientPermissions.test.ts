import { describe, expect, it } from "vitest";

import type { PatientDetail } from "../../../types/patients";
import { getPatientPermissions } from "./patientPermissions";

const activePatient = { id: 1, is_archived: false } as PatientDetail;
const archivedPatient = { id: 2, is_archived: true } as PatientDetail;

describe("getPatientPermissions", () => {
  it("keeps Admin read-only", () => {
    expect(getPatientPermissions("ADMIN", activePatient)).toMatchObject({
      canCreate: false,
      canEdit: false,
      canArchive: false,
      canUnarchive: false,
      canViewArchivedFilter: true,
    });
  });

  it("allows Staff patient management", () => {
    expect(getPatientPermissions("STAFF", activePatient)).toMatchObject({
      canCreate: true,
      canEdit: true,
      canArchive: true,
      canUnarchive: false,
    });
    expect(getPatientPermissions("STAFF", archivedPatient).canUnarchive).toBe(true);
    expect(getPatientPermissions("STAFF", archivedPatient).canEdit).toBe(false);
  });

  it("allows Doctor profile editing but not archive controls", () => {
    expect(getPatientPermissions("DOCTOR", activePatient)).toMatchObject({
      canEdit: true,
      canArchive: false,
      canUnarchive: false,
      canViewArchivedFilter: false,
    });
  });
});
