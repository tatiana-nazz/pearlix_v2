import { expect, test, type Locator, type Page } from "@playwright/test";

const password = process.env.PEARLIX_E2E_PASSWORD;

async function login(page: Page) {
  if (!password) throw new Error("PEARLIX_E2E_PASSWORD must be set for the local demo account.");
  await page.goto("/login");
  await page.getByLabel("Email").fill("admin@pearlix-demo.local");
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);

  const english = page.getByRole("button", { name: "EN", exact: true });
  if (await english.getAttribute("aria-pressed") !== "true") await english.click();
  await expect(english).toHaveAttribute("aria-pressed", "true");
  if (await page.locator("html").getAttribute("data-theme") !== "light") await page.locator(".theme-toggle").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
}

async function expectNoDocumentOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
}

async function expectControlTheme(controls: Locator, theme: "light" | "dark") {
  const styles = await controls.evaluateAll((elements) => elements.map((element) => {
    const style = getComputedStyle(element);
    return {
      background: style.backgroundColor,
      border: style.borderColor,
      color: style.color,
      colorScheme: style.colorScheme,
      width: element.getBoundingClientRect().width,
    };
  }));
  expect(styles.length).toBeGreaterThan(0);
  for (const style of styles) {
    expect(style.colorScheme).toContain(theme);
    expect(style.background).not.toBe("rgb(0, 0, 0)");
    expect(style.background).not.toBe("rgba(0, 0, 0, 0)");
    expect(style.border).not.toBe("rgb(0, 0, 0)");
    expect(style.color).not.toBe(style.background);
    expect(style.width).toBeGreaterThan(0);
  }
}

test("UI foundation and Audit Logs remain stable across themes, RTL, and bounded responsive views", async ({ page }) => {
  test.setTimeout(120_000);
  const invalidHookErrors: string[] = [];
  page.on("pageerror", (error) => { if (/invalid hook call/i.test(error.message)) invalidHookErrors.push(error.message); });
  page.on("console", (message) => { if (message.type() === "error" && /invalid hook call/i.test(message.text())) invalidHookErrors.push(message.text()); });

  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page);

  await page.goto("/admin/doctors");
  await expect(page.getByRole("heading", { name: "Schedules and leave" })).toBeVisible();
  const employee = page.locator('label:has-text("Employee") select').first();
  await expect(employee).toBeVisible();
  await employee.selectOption({ index: 1 });
  await expect(page.locator('label:has-text("Copy source") select')).toBeVisible();
  await expectControlTheme(page.locator(".schedule-page input, .schedule-page select"), "light");
  const primary = page.locator(".schedule-page .button.primary").first();
  await primary.hover();
  const primaryHover = await primary.evaluate((element) => {
    const style = getComputedStyle(element);
    return { backgroundImage: style.backgroundImage, color: style.color, transform: style.transform };
  });
  expect(primaryHover.backgroundImage).toContain("linear-gradient");
  expect(primaryHover.color).toBe("rgb(255, 255, 255)");
  expect(primaryHover.transform).not.toBe("none");
  await expectNoDocumentOverflow(page);

  await page.goto("/admin/leave");
  await expect(page.getByRole("heading", { name: "Leave and availability" })).toBeVisible();
  await expectControlTheme(page.locator(".schedule-page input, .schedule-page select"), "light");
  await expect(page.getByRole("button", { name: "Create unavailable period" })).toBeVisible();
  await expectNoDocumentOverflow(page);

  await page.goto("/admin/audit-logs");
  await expect(page.getByRole("table", { name: "Audit records" })).toBeVisible();
  const firstAuditRow = page.locator(".audit-table tbody tr").first();
  const recordLabel = await firstAuditRow.getAttribute("aria-label");
  expect(recordLabel).toMatch(/^Open audit record \d+$/);
  const auditId = recordLabel!.match(/\d+$/)![0];
  await firstAuditRow.press("Enter");
  await expect(page).toHaveURL(new RegExp(`/admin/audit-logs/${auditId}$`));
  await expect(page.getByRole("heading", { name: "Audit Record" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Metadata" })).toBeVisible();
  await expect(page.getByLabel("Audit metadata")).toBeVisible();
  await expect(page.getByText(/Invalid hook call/i)).toHaveCount(0);
  await expectNoDocumentOverflow(page);
  const auditDetailPath = new URL(page.url()).pathname;

  await page.goto("/admin/users");
  const firstUserRow = page.locator(".users-identity-table tbody tr").first();
  await expect(firstUserRow).toBeVisible();
  await firstUserRow.press("Enter");
  await expect(page).toHaveURL(/\/admin\/users\/\d+$/);
  await expect(page.locator(".v2-field input, .v2-field select").first()).toBeVisible();
  await expectControlTheme(page.locator(".v2-field input, .v2-field select"), "light");
  await expectNoDocumentOverflow(page);

  await page.goto("/admin/billing/invoices");
  await expect(page.getByRole("heading", { name: "Billing", exact: true })).toBeVisible();
  const inactiveBillingTab = page.getByRole("link", { name: "Handoffs", exact: true });
  await inactiveBillingTab.hover();
  const billingHover = await inactiveBillingTab.evaluate((element) => {
    const style = getComputedStyle(element);
    return { background: style.backgroundColor, color: style.color };
  });
  expect(billingHover.background).not.toBe("rgb(0, 0, 0)");
  expect(billingHover.background).not.toBe("rgb(255, 255, 255)");
  expect(billingHover.color).not.toBe(billingHover.background);
  const status = page.locator(".v2-status").first();
  await expect(status).toBeVisible();
  const statusAlignment = await status.evaluate((element) => {
    const style = getComputedStyle(element);
    const badge = element.getBoundingClientRect();
    const icon = element.querySelector("svg")!.getBoundingClientRect();
    return {
      alignItems: style.alignItems,
      minHeight: Number.parseFloat(style.minHeight),
      centerDelta: Math.abs((badge.top + badge.height / 2) - (icon.top + icon.height / 2)),
    };
  });
  expect(statusAlignment.alignItems).toBe("center");
  expect(statusAlignment.minHeight).toBeGreaterThanOrEqual(26);
  expect(statusAlignment.centerDelta).toBeLessThanOrEqual(1);
  await expectControlTheme(page.locator(".billing-page select"), "light");
  await expectNoDocumentOverflow(page);

  await page.locator(".theme-toggle").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  for (const path of ["/admin/doctors", "/admin/leave", auditDetailPath, "/admin/billing/invoices"]) {
    await page.goto(path);
    await expect(page.locator(".workspace-content")).not.toBeEmpty();
    const controls = page.locator(".workspace-content input, .workspace-content select, .workspace-content textarea");
    if (await controls.count()) await expectControlTheme(controls, "dark");
    await expectNoDocumentOverflow(page);
  }
  await expect(page.getByText(/Invalid hook call/i)).toHaveCount(0);

  await page.getByRole("button", { name: "AR", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await page.goto("/admin/doctors");
  await expect(page.locator(".app-shell")).toHaveAttribute("dir", "rtl");
  await expectNoDocumentOverflow(page);
  await page.goto(auditDetailPath);
  await expect(page.getByLabel("Audit metadata")).toBeVisible();
  await expectNoDocumentOverflow(page);

  const responsiveChecks = [
    { width: 1440, height: 900, path: "/admin/doctors" },
    { width: 1280, height: 720, path: auditDetailPath },
    { width: 1024, height: 768, path: "/admin/billing/invoices" },
  ];
  for (const check of responsiveChecks) {
    await page.setViewportSize({ width: check.width, height: check.height });
    await page.goto(check.path);
    await expect(page.locator(".workspace-content")).not.toBeEmpty();
    await expectNoDocumentOverflow(page);
  }

  expect(invalidHookErrors).toEqual([]);
});
