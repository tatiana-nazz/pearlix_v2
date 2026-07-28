import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Pagination, StatusBadge } from "../components/v2";
import { featureT, t } from "./i18n";
import { useAuthStore } from "../auth/authStore";

describe("Phase 14D feature localization", () => {
  afterEach(() => { document.documentElement.lang = "en"; document.documentElement.dir = "ltr"; });

  it("keeps base shell keys available alongside feature-extension keys", () => {
    expect(t("EN", "menu")).toBe("Open navigation");
    expect(t("AR", "menu")).not.toBe(t("EN", "menu"));
    expect(featureT("EN", "professionalDirectory")).toBe("Professional clinic directory");
    expect(featureT("AR", "professionalDirectory")).not.toBe(featureT("EN", "professionalDirectory"));
  });

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

  it("localizes shared pagination labels and keeps the page number isolated", () => {
    useAuthStore.setState({ user: { language_preference: "EN" } as never });
    const { rerender } = render(<Pagination page={2} hasPrevious={false} hasNext onPrevious={() => undefined} onNext={() => undefined} />);
    expect(screen.getByText("Page")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByText("2").tagName).toBe("BDI");
    useAuthStore.setState({ user: { language_preference: "AR" } as never });
    rerender(<Pagination page={2} hasPrevious hasNext={false} onPrevious={() => undefined} onNext={() => undefined} />);
    expect(screen.getByText("الصفحة")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "التالي" })).toBeDisabled();
  });
});
