import { describe, expect, it } from "vitest";

import { normalizeApiEndpoint } from "./http";

describe("normalizeApiEndpoint", () => {
  const baseUrl = "http://127.0.0.1:8000/api";

  it("prevents API-rooted serializer links from duplicating the configured API base", () => {
    expect(normalizeApiEndpoint("/api/xrays/48/file/", baseUrl)).toBe("/xrays/48/file/");
  });

  it("keeps ordinary client-relative and absolute routes intact", () => {
    expect(normalizeApiEndpoint("/xrays/48/file/", baseUrl)).toBe("/xrays/48/file/");
    expect(normalizeApiEndpoint("https://example.test/api/xrays/48/file/", baseUrl)).toBe("https://example.test/api/xrays/48/file/");
  });
});
