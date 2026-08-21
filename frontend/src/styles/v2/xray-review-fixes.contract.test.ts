import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../../..");
const fixes = readFileSync(resolve(root, "src/styles/v2/xray-review-fixes.css"), "utf8");
const index = readFileSync(resolve(root, "src/styles/v2/index.css"), "utf8");

describe("active X-ray review presentation", () => {
  it("lets page scrolling chain through the X-ray canvas instead of trapping the wheel", () => {
    expect(fixes).toContain("overscroll-behavior: auto");
  });

  it("keeps the panoramic image at natural height instead of stretching to the result column", () => {
    expect(fixes).toContain(".active-xray-main-row");
    expect(fixes).toContain("align-items: start");
    expect(fixes).toContain("block-size: auto");
    expect(fixes).toContain("max-block-size: none");
  });

  it("makes long desktop AI results independently scrollable and loads the override last", () => {
    expect(fixes).toContain(".active-xray-ai-result > .card");
    expect(fixes).toContain("overflow-y: auto");
    expect(fixes).toContain("scrollbar-gutter: stable");
    expect(index.trim().endsWith('@import "./xray-review-fixes.css";')).toBe(true);
  });
});
