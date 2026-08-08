import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../../..");
const colors = readFileSync(resolve(root, "src/styles/v2/colors.css"), "utf8");
const shell = readFileSync(resolve(root, "src/layouts/Shell.css"), "utf8");
const navigation = readFileSync(resolve(root, "src/layouts/navigation.tsx"), "utf8");
const utilities = readFileSync(resolve(root, "src/styles/v2/utilities.css"), "utf8");
const compatibility = readFileSync(resolve(root, "src/styles/v2/compatibility.css"), "utf8");
const viteConfig = readFileSync(resolve(root, "vite.config.ts"), "utf8");

describe("Phase 14F visual source token and icon contract", () => {
  it("defines the supplied light/dark semantic tokens and preserved 264/76/68 shell dimensions", () => {
    for (const token of ["canvas", "surface", "surface-subtle", "border", "text", "muted", "primary", "success", "warning", "danger", "info", "neutral"]) expect((colors.match(new RegExp(`--v2-${token}:`, "g")) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(colors).toContain('[data-theme="dark"]');
    expect(colors).toContain("--v2-canvas: #f6f8fc");
    expect(colors).toContain("--v2-primary: #3f63f2");
    expect(colors).toContain("--v2-primary-strong: #2f51d9");
    expect(colors).toContain("--v2-gradient-primary: linear-gradient(135deg, #3f63f2 0%, #5baef7 100%)");
    expect(colors).toContain("--v2-shadow-major: 0 12px 30px rgba(30, 41, 59, 0.06)");
    expect(shell).toContain("--sidebar-size: 264px");
    expect(shell).toContain("--sidebar-size: 76px");
    expect(shell).toContain("min-height: 68px");
    expect(shell).toContain("overflow-x: clip");
  });
  it("keeps Lucide React as the sole functional icon source in the navigation map", () => { expect(navigation).toContain('from "lucide-react"'); expect(navigation).not.toMatch(/react-icons|fontawesome|material-icons|emoji/i); });
  it("provides a reusable bidi-isolation utility for identifiers and mixed-script values", () => { expect(utilities).toContain(".bidi-ltr"); expect(utilities).toContain("unicode-bidi:isolate"); expect(utilities).toContain("direction:ltr"); });
  it("binds native controls, shared buttons, and statuses to the active Pearlix theme", () => {
    for (const type of ["email", "password", "number", "date", "time", "datetime-local"]) expect(compatibility).toContain(`input[type="${type}"]`);
    expect(compatibility).toContain("color-scheme: inherit");
    expect(compatibility).toContain("background: var(--v2-surface-subtle)");
    expect(compatibility).toContain(":not(:disabled):hover");
    expect(compatibility).toContain("outline: 3px solid var(--v2-focus)");
    expect(compatibility).toContain("-webkit-text-fill-color: var(--v2-muted)");
    expect(compatibility).toContain(".v2-status");
    expect(compatibility).toContain("align-self: center");
  });
  it("uses a single strict canonical local frontend origin", () => { expect(viteConfig).toContain('host: "127.0.0.1"'); expect(viteConfig).toContain("port: 5173"); expect(viteConfig).toContain("strictPort: true"); });
});
