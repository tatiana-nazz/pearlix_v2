import { describe, expect, it } from "vitest";

import { activeDatePreset, dateRangeForPreset, handoffQueryFromSearch, invoiceQueryFromSearch } from "./billingQuery";

describe("billing invoice date query", () => {
  it("builds inclusive clinic-date presets without using the browser clock", () => {
    expect(dateRangeForPreset("TODAY", "2026-07-15")).toEqual({ date_from: "2026-07-15", date_to: "2026-07-15" });
    expect(dateRangeForPreset("LAST_7_DAYS", "2026-07-15")).toEqual({ date_from: "2026-07-09", date_to: "2026-07-15" });
    expect(dateRangeForPreset("LAST_30_DAYS", "2026-07-15")).toEqual({ date_from: "2026-06-16", date_to: "2026-07-15" });
    expect(dateRangeForPreset("ALL_TIME", "2026-07-15")).toEqual({ date_from: "", date_to: "" });
  });

  it("recognizes standard and custom ranges", () => {
    expect(activeDatePreset("", "", "2026-07-15")).toBe("ALL_TIME");
    expect(activeDatePreset("2026-07-09", "2026-07-15", "2026-07-15")).toBe("LAST_7_DAYS");
    expect(activeDatePreset("2026-07-01", "2026-07-10", "2026-07-15")).toBe("CUSTOM");
  });

  it("keeps supported URL filters and omits empty values", () => {
    const query = invoiceQueryFromSearch(new URLSearchParams("search=Maya&currency=USD&page=2&status=OPEN&ignored=value"));
    expect(query).toEqual({ search: "Maya", currency: "USD", page: "2" });
    expect(handoffQueryFromSearch(new URLSearchParams("search=Maya&status=OPEN&currency=SYP"))).toEqual({ status: "OPEN", currency: "SYP", search: "Maya" });
  });
});
