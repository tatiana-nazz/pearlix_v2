import { describe, expect, it } from "vitest";

import { ApiClientError } from "../api/errors";
import { loginErrorMessage } from "./apiErrors";

describe("loginErrorMessage", () => {
  it("distinguishes credential, disabled-account, unavailable-service, and server errors", () => {
    expect(loginErrorMessage(new ApiClientError({ code: "INVALID_CREDENTIALS", message: "Request failed.", details: {}, status: 401 }), "EN")).toBe("Invalid email or password.");
    expect(loginErrorMessage(new ApiClientError({ code: "ACCOUNT_DISABLED", message: "Request failed.", details: {}, status: 401 }), "EN")).toContain("disabled");
    expect(loginErrorMessage(new ApiClientError({ code: "NETWORK_ERROR", message: "Network request failed.", details: {}, status: 0 }), "EN")).toContain("service is unavailable");
    expect(loginErrorMessage(new ApiClientError({ code: "REQUEST_FAILED", message: "Request failed.", details: {}, status: 500 }), "EN")).toContain("unexpected error");
  });

  it("provides Arabic login failure copy", () => {
    expect(loginErrorMessage(new ApiClientError({ code: "NETWORK_ERROR", message: "Network request failed.", details: {}, status: 0 }), "AR")).not.toContain("Network request failed");
    expect(loginErrorMessage(new ApiClientError({ code: "ACCOUNT_DISABLED", message: "Request failed.", details: {}, status: 401 }), "AR")).toMatch(/[\u0600-\u06ff]/);
  });
});
