import { expect, test, type Page } from "@playwright/test";

const password = process.env.PEARLIX_E2E_PASSWORD;
const viewports = [
  { width: 1920, height: 1080 },
  { width: 1536, height: 864 },
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
  { width: 1280, height: 720 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
] as const;

async function login(page: Page, email: string) {
  if (!password) throw new Error("PEARLIX_E2E_PASSWORD must be set.");
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/(admin|staff|doctor)\/dashboard$/);
  const english = page.getByRole("button", { name: "EN", exact: true });
  if (await english.getAttribute("aria-pressed") !== "true") await english.click();
  if (await page.locator("html").getAttribute("data-theme") !== "light") await page.locator(".theme-toggle").click();
}

async function expectNoDocumentOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
}

async function expectEqualRows(page: Page, selector: string) {
  const geometry = await page.locator(selector).evaluateAll((nodes) => nodes.map((node) => {
    const rect = node.getBoundingClientRect();
    return { top: Math.round(rect.top), height: Math.round(rect.height) };
  }));
  const rows = new Map<number, number[]>();
  for (const item of geometry) rows.set(item.top, [...(rows.get(item.top) ?? []), item.height]);
  for (const heights of rows.values()) {
    if (heights.length > 1) expect(new Set(heights).size).toBe(1);
  }
}

test("status badges remain content-sized and repeated cards stay stable at the frozen viewport matrix", async ({ page }) => {
  test.setTimeout(90_000);
  await login(page, "staff.one@pearlix-demo.local");
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/staff/dashboard");
    await expectEqualRows(page, ".dashboard-v2-metrics .v2-card");
    await expectNoDocumentOverflow(page);

    await page.goto("/staff/appointments/list");
    const badges = page.locator(".appointment-table .v2-status");
    await expect(badges.first()).toBeVisible();
    const badgeContract = await badges.evaluateAll((nodes) => nodes.map((node) => {
      const style = getComputedStyle(node);
      const cell = node.closest("td")!.getBoundingClientRect();
      const rect = node.getBoundingClientRect();
      return { display: style.display, flexGrow: style.flexGrow, badgeWidth: rect.width, cellWidth: cell.width };
    }));
    expect(badgeContract.every((item) => item.display === "inline-flex" && item.flexGrow === "0" && item.badgeWidth < item.cellWidth)).toBe(true);
    await expectNoDocumentOverflow(page);

    await page.goto("/staff/team");
    await expect(page.locator(".team-directory-card").first()).toBeVisible();
    await expectEqualRows(page, ".team-directory-card");
    await expectNoDocumentOverflow(page);

    await page.goto("/staff/billing/invoices");
    await expectEqualRows(page, ".billing-summary-card");
    await expectNoDocumentOverflow(page);
  }
});

test("Doctor One exposes the split schedule, editable active visit, and one layered AI canvas", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page, "doctor.one@pearlix-demo.local");
  await page.goto("/doctor/profile");
  await expect(page.locator(".schedule-matrix tbody tr")).toHaveCount(2);
  await expect(page.getByRole("row", { name: /Morning.*Off Off/ })).toBeVisible();
  await expect(page.getByRole("row", { name: /Evening.*Off Off/ })).toBeVisible();

  await page.goto("/doctor/visits/active");
  await expect(page.getByRole("heading", { name: "Lina Mansour", exact: true }).first()).toBeVisible();
  await expect(page.getByLabel("Clinical notes")).toBeEditable();
  await expect(page.getByRole("button", { name: "Save Notes" })).toBeVisible();

  await page.goto("/doctor/xrays");
  await page.getByRole("row", { name: /Synthetic demo X-ray with mock AI/ }).click();
  await expect(page.locator(".protected-xray-viewer")).toHaveCount(1);
  await expect(page.locator(".protected-xray-canvas")).toHaveCount(1);
  const toggle = page.getByRole("button", { name: "Show AI overlay" });
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await toggle.click();
  await expect(page.getByRole("button", { name: "Hide AI overlay" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".protected-xray-overlay")).toBeVisible();
  const geometry = await page.evaluate(() => {
    const original = document.querySelector(".protected-xray-original")!.getBoundingClientRect();
    const overlay = document.querySelector(".protected-xray-overlay")!.getBoundingClientRect();
    return [overlay.x - original.x, overlay.y - original.y, overlay.width - original.width, overlay.height - original.height];
  });
  expect(geometry.every((delta) => Math.abs(delta) < 0.1)).toBe(true);
  await page.getByRole("button", { name: "AR", exact: true }).click();
  await expect(page.getByRole("button", { name: "إخفاء طبقة الذكاء الاصطناعي" })).toBeVisible();
  await expectNoDocumentOverflow(page);
});

test("Admin clinic settings cards align without fixed mobile height", async ({ page }) => {
  await login(page, "admin@pearlix-demo.local");
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 768, height: 1024 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/admin/clinic-settings");
    await expectEqualRows(page, ".clinic-settings-card");
    await expectNoDocumentOverflow(page);
  }
});
