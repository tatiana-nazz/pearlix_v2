import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../../..");
const colors = readFileSync(resolve(root, "src/styles/v2/colors.css"), "utf8");
const shell = readFileSync(resolve(root, "src/layouts/Shell.css"), "utf8");
const navigation = readFileSync(resolve(root, "src/layouts/navigation.tsx"), "utf8");
const utilities = readFileSync(resolve(root, "src/styles/v2/utilities.css"), "utf8");
const components = readFileSync(resolve(root, "src/styles/v2/components.css"), "utf8");
const globals = readFileSync(resolve(root, "src/styles/globals.css"), "utf8");

describe("Medical-blue global foundation contracts", () => {
  it("defines the accepted light and dark semantic token values", () => {
    for (const [token, value] of Object.entries({ primary: "#3F6DF6", "primary-hover": "#315BE0", "page-bg": "#F4F7FC", surface: "#FFFFFF", border: "#E3EAF5", "text-main": "#0F1F3A", success: "#16A36A", warning: "#D99000", danger: "#D92D5A", active: "#7C3AED" })) expect(colors).toContain(`--color-${token}: ${value};`);
    for (const [token, value] of Object.entries({ "page-bg": "#0F172A", surface: "#162238", "surface-muted": "#1B2942", "surface-hover": "#22324F", border: "#2B3A55", "text-main": "#F8FAFC", "input-focus": "#6D8DFF" })) expect(colors).toContain(`--color-${token}: ${value};`);
    expect(colors).toContain('--v2-primary: var(--color-primary);');
    expect(colors).toContain('--v2-surface: var(--color-surface);');
  });

  it("keeps the complete medical-blue light and navy dark foundations tokenized", () => {
    for (const [token, value] of Object.entries({ "primary-active": "#244BC5", "surface-selected": "#EAF0FF", "surface-disabled": "#F1F5F9", "border-subtle": "#EDF2FA", "text-heading": "#0B1B34", "text-disabled": "#A8B4C5" })) expect(colors).toContain(`--color-${token}: ${value};`);
    for (const [token, value] of Object.entries({ "surface-selected": "#1E3A8A", "surface-disabled": "#202E45", "border-subtle": "#26354F", "text-heading": "#FFFFFF", "text-disabled": "#64748B" })) expect(colors).toContain(`--color-${token}: ${value};`);
    expect(colors).toContain("--shadow-modal: 0 24px 70px rgba(15, 31, 58, 0.18);");
    expect(colors).toContain("--shadow-modal: 0 24px 70px rgba(8, 22, 45, 0.36);");
  });

  it("keeps shell dimensions and the bidi utility contract", () => {
    expect(shell).toContain("--sidebar-size:272px"); expect(shell).toContain("--sidebar-size:84px"); expect(shell).toContain("min-height:72px");
    expect(utilities).toContain(".bidi-ltr"); expect(utilities).toContain("unicode-bidi:isolate"); expect(utilities).toContain("direction:ltr");
  });

  it("uses semantic shared controls rather than page-specific visual states", () => {
    const overlay = readFileSync(resolve(root, "src/styles/v2/overlay.css"), "utf8");
    const compatibility = readFileSync(resolve(root, "src/styles/v2/compatibility.css"), "utf8");
    expect(components).toContain(".v2-button.danger { background:var(--color-danger-bg);");
    expect(components).toContain(".v2-button:disabled { background:var(--v2-surface-disabled);");
    expect(components).toContain(".v2-field input:focus-visible");
    expect(components).toContain(".v2-tab[aria-selected=\"true\"] { background:var(--v2-primary);");
    expect(components).toContain(".v2-status.success");
    expect(components).toContain(".v2-status.warning");
    expect(components).toContain(".v2-status.danger");
    expect(components).toContain(".v2-status.info");
    expect(components).toContain(".v2-status.ai");
    expect(components).not.toContain("linear-gradient");
    expect(globals).toContain(".xray-canvas");
    expect(globals).not.toContain(".xray-canvas { display:grid; place-items:center; min-block-size:360px; overflow:hidden; border:1px solid var(--v2-border,var(--color-border)); border-radius:var(--v2-radius-card,16px); background:linear-gradient");
    expect(overlay).toContain("border-radius:var(--v2-radius-dialog)");
    expect(overlay).toContain("box-shadow:var(--v2-shadow-modal)");
    expect(compatibility).toContain(".form-stack input:focus-visible");
  });

  it("keeps Lucide React as the sole functional icon source in the navigation map", () => { expect(navigation).toContain('from "lucide-react"'); expect(navigation).not.toMatch(/react-icons|fontawesome|material-icons|emoji/i); });

  it("removes underlines from interactive KPI cards, preview rows, and dashboard actions", () => {
    expect(components).toContain(".kpi-link { color:inherit; cursor:pointer; text-decoration:none;");
    expect(components).toContain(".summary-row { border-radius:var(--v2-radius-small); color:inherit; cursor:pointer; text-decoration:none;");
    expect(components).toContain(".v2-text-action { display:inline-flex;");
    expect(components).toContain(".kpi-link:focus-visible,.summary-row:focus-visible,.v2-text-action:focus-visible");
  });

  it("keeps readable shared typography, simple sidebar controls, and aligned card grids without a global overflow workaround", () => {
    const typography = readFileSync(resolve(root, "src/styles/v2/typography.css"), "utf8");
    expect(typography).toContain("--v2-font-size-nav:15px");
    expect(typography).toContain("--v2-font-size-label:14px");
    expect(typography).toContain("--v2-font-size-helper:13px");
    expect(components).toContain(".v2-button { display:inline-flex;");
    expect(components).toContain("text-decoration:none;");
    expect(shell).toContain(".sidebar-toggle-simple { border-color:transparent; background:transparent;");
    expect(shell).toContain(".workspace-header .v2-icon-button[data-tooltip]::after { inset-inline-start:auto; inset-inline-end:0; transform:none; }");
    expect(globals).toContain(".dashboard-grid > *");
    expect(globals).toContain("align-items: stretch;");
    expect(shell).not.toContain(".app-shell { overflow-x:hidden");
  });
});
