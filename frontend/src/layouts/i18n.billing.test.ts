import { describe, expect, it } from "vitest";

import { featureT } from "./i18n";

describe("Billing localization", () => {
  it("provides typed Arabic billing labels alongside English labels", () => {
    expect(featureT("EN", "recordPayment")).toBe("Record payment");
    expect(featureT("AR", "recordPayment")).toBe("تسجيل دفعة");
    expect(featureT("AR", "billingHandoffs")).toBe("تحويلات الفوترة");
  });
});
