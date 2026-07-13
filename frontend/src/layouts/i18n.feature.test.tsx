import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { StatusBadge } from "../components/v2";
import { featureT } from "./i18n";

describe("Phase 14D feature localization", () => {
  afterEach(() => { document.documentElement.lang = "en"; document.documentElement.dir = "ltr"; });

  it("provides Arabic copy for representative dashboard, Team, Users, patient, and appointment actions", () => {
    expect(featureT("AR", "clinicOperations")).not.toBe(featureT("EN", "clinicOperations"));
    expect(featureT("AR", "addTeamMember")).not.toBe(featureT("EN", "addTeamMember"));
    expect(featureT("AR", "usersAccess")).not.toBe(featureT("EN", "usersAccess"));
    expect(featureT("AR", "archivePatient")).not.toBe(featureT("EN", "archivePatient"));
    expect(featureT("AR", "needsReschedule")).not.toBe(featureT("EN", "needsReschedule"));
    expect(featureT("AR", "dayAppointments")).not.toBe(featureT("EN", "dayAppointments"));
    expect(featureT("AR", "saveReschedule")).not.toBe(featureT("EN", "saveReschedule"));
    expect(featureT("AR", "discardChanges")).not.toBe(featureT("EN", "discardChanges"));
  });

  it("maps known backend status codes to localized labels rather than exposing raw enums", () => {
    document.documentElement.lang = "ar"; document.documentElement.dir = "rtl";
    render(<StatusBadge status="NEEDS_RESCHEDULE" />);
    expect(screen.getByText("يحتاج إعادة جدولة")).toBeInTheDocument();
    expect(screen.queryByText("NEEDS_RESCHEDULE")).not.toBeInTheDocument();
  });

  it("retains bidi-safe utility support when rendering mixed-direction account identifiers", () => {
    render(<span className="bidi-isolate">admin@example.test</span>);
    expect(screen.getByText("admin@example.test")).toHaveClass("bidi-isolate");
  });
});
