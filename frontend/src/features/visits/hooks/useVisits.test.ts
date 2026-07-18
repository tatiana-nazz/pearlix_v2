import { describe, expect, it } from "vitest";

import { ApiClientError } from "../../../api/errors";
import { isNoActiveVisitError } from "./useVisits";

describe("active visit query error contract", () => {
  it("converts only the documented no-active-visit response into an empty result", () => {
    expect(isNoActiveVisitError(new ApiClientError({ code: "NOT_FOUND", message: "No active visit found.", details: {}, status: 404 }))).toBe(true);
    expect(isNoActiveVisitError(new ApiClientError({ code: "NOT_FOUND", message: "Other missing resource", details: {}, status: 500 }))).toBe(false);
    expect(isNoActiveVisitError(new ApiClientError({ code: "REQUEST_FAILED", message: "Server error", details: {}, status: 500 }))).toBe(false);
    expect(isNoActiveVisitError(new Error("Network request failed."))).toBe(false);
  });
});
