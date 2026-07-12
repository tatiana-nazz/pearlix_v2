import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../../..");
const colors = readFileSync(resolve(root, "src/styles/v2/colors.css"), "utf8");
const shell = readFileSync(resolve(root, "src/layouts/Shell.css"), "utf8");
const navigation = readFileSync(resolve(root, "src/layouts/navigation.tsx"), "utf8");
const utilities = readFileSync(resolve(root, "src/styles/v2/utilities.css"), "utf8");
const components = readFileSync(resolve(root, "src/styles/v2/components.css"), "utf8");

describe("Phase 14D palette and shared interaction contracts", () => {
  it("defines the accepted light and dark semantic token values", () => {
    for (const [token, value] of Object.entries({ primary: "#3F6DF6", "primary-hover": "#315BE0", "page-bg": "#F4F7FC", surface: "#FFFFFF", border: "#E3EAF5", "text-main": "#0F1F3A", success: "#16A36A", warning: "#D99000", danger: "#D92D5A", active: "#7C3AED" })) expect(colors).toContain(`--color-${token}: ${value};`);
    for (const [token, value] of Object.entries({ "page-bg": "#0F172A", surface: "#162238", "surface-muted": "#1B2942", "surface-hover": "#22324F", border: "#2B3A55", "text-main": "#F8FAFC", "input-focus": "#6D8DFF" })) expect(colors).toContain(`--color-${token}: ${value};`);
    expect(colors).toContain('--v2-primary: var(--color-primary);');
    expect(colors).toContain('--v2-surface: var(--color-surface);');
  });

  it("keeps shell dimensions and the bidi utility contract", () => {
    expect(shell).toContain("--sidebar-size:272px"); expect(shell).toContain("--sidebar-size:84px"); expect(shell).toContain("min-height:72px");
    expect(utilities).toContain(".bidi-ltr"); expect(utilities).toContain("unicode-bidi:isolate"); expect(utilities).toContain("direction:ltr");
  });

  it("keeps Lucide React as the sole functional icon source in the navigation map", () => { expect(navigation).toContain('from "lucide-react"'); expect(navigation).not.toMatch(/react-icons|fontawesome|material-icons|emoji/i); });

  it("removes underlines from interactive KPI cards, preview rows, and dashboard actions", () => {
    expect(components).toContain(".kpi-link { color:inherit; cursor:pointer; text-decoration:none;");
    expect(components).toContain(".summary-row { border-radius:var(--v2-radius-small); color:inherit; cursor:pointer; text-decoration:none;");
    expect(components).toContain(".v2-text-action { display:inline-flex;");
    expect(components).toContain(".kpi-link:focus-visible,.summary-row:focus-visible,.v2-text-action:focus-visible");
  });
});
