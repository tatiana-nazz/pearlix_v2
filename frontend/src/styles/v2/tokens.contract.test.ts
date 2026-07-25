import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../../..");
const colors = readFileSync(resolve(root, "src/styles/v2/colors.css"), "utf8");
const shell = readFileSync(resolve(root, "src/layouts/Shell.css"), "utf8");
const navigation = readFileSync(resolve(root, "src/layouts/navigation.tsx"), "utf8");
const utilities = readFileSync(resolve(root, "src/styles/v2/utilities.css"), "utf8");
const viteConfig = readFileSync(resolve(root, "vite.config.ts"), "utf8");

describe("Phase 14C token and icon source contract", () => {
  it("defines required light/dark semantic tokens and 272/84/72 shell dimensions", () => {
    for (const token of ["canvas", "surface", "surface-subtle", "border", "text", "muted", "primary", "success", "warning", "danger", "info", "neutral"]) expect((colors.match(new RegExp(`--v2-${token}:`, "g")) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(colors).toContain('[data-theme="dark"]');
    expect(shell).toContain("--sidebar-size:272px"); expect(shell).toContain("--sidebar-size:84px"); expect(shell).toContain("min-height:72px"); expect(shell).toContain("overflow-x:clip");
  });
  it("keeps Lucide React as the sole functional icon source in the navigation map", () => { expect(navigation).toContain('from "lucide-react"'); expect(navigation).not.toMatch(/react-icons|fontawesome|material-icons|emoji/i); });
  it("provides a reusable bidi-isolation utility for identifiers and mixed-script values", () => { expect(utilities).toContain(".bidi-ltr"); expect(utilities).toContain("unicode-bidi:isolate"); expect(utilities).toContain("direction:ltr"); });
  it("uses a single strict canonical local frontend origin", () => { expect(viteConfig).toContain('host: "127.0.0.1"'); expect(viteConfig).toContain("port: 5173"); expect(viteConfig).toContain("strictPort: true"); });
});
