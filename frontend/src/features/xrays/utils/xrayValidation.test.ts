import { describe, expect, it } from "vitest";

import { maxXraySizeBytes, validateXrayFile } from "./xrayValidation";

describe("validateXrayFile", () => {
  it("accepts PNG and JPEG files within the upload limit", () => {
    expect(validateXrayFile(new File(["image"], "xray.jpeg", { type: "image/jpeg" }))).toBeNull();
  });

  it("rejects unsupported file types and oversize files", () => {
    expect(validateXrayFile(new File(["pdf"], "xray.pdf", { type: "application/pdf" }))).toContain("Supported formats");
    expect(validateXrayFile(new File([new Uint8Array(maxXraySizeBytes + 1)], "large.png", { type: "image/png" }))).toContain("10 MB");
  });
});
