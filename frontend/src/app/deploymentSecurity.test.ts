import { describe, expect, it } from "vitest";

import vercelConfig from "../../vercel.json";

describe("frontend deployment security configuration", () => {
  it("denies framing without replacing the SPA rewrite", () => {
    const globalHeaders = vercelConfig.headers.find(({ source }) => source === "/(.*)")?.headers;
    const headers = Object.fromEntries(
      (globalHeaders ?? []).map(({ key, value }) => [key.toLowerCase(), value]),
    );

    expect(headers).toMatchObject({
      "content-security-policy": "frame-ancestors 'none'",
      "x-frame-options": "DENY",
    });
    expect(vercelConfig.rewrites).toEqual([
      { source: "/(.*)", destination: "/index.html" },
    ]);
  });
});
