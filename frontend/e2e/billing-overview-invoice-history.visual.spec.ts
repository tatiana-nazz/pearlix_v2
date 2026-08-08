import { expect, test, type Page } from "@playwright/test";

const password = process.env.PEARLIX_E2E_PASSWORD;
type BillingRole = "admin" | "staff" | "doctor";
const accounts: Record<BillingRole, string> = {
  admin: "admin@pearlix-demo.local",
  staff: "staff.one@pearlix-demo.local",
  doctor: "doctor.one@pearlix-demo.local",
};

async function login(page: Page, role: BillingRole) {
  if (!password) throw new Error("PEARLIX_E2E_PASSWORD must be set.");
  await page.goto("/login");
  await page.getByLabel("Email").fill(accounts[role]);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(new RegExp(`/${role}/dashboard$`));
  const english = page.getByRole("button", { name: "EN", exact: true });
  if (await english.getAttribute("aria-pressed") !== "true") await english.click();
}

async function expectNoDocumentOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  expect(await page.locator("body").innerText()).not.toHaveLength(0);
  await expect(page.locator(".vite-error-overlay, #webpack-dev-server-client-overlay, [data-nextjs-dialog]")).toHaveCount(0);
}

test.describe("billing overview and invoice history", () => {
  test("Admin lands on a read-only billing overview with complete navigation", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page, "admin");
    await page.goto("/admin/billing");
    await expect(page).toHaveURL(/\/admin\/billing\/overview$/);
    await expect(page.getByRole("heading", { name: "Billing overview", exact: true })).toBeVisible();
    for (const tab of ["Overview", "Handoffs", "Invoices"]) await expect(page.getByRole("link", { name: tab, exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "New invoice" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /payment|cancel|convert|dismiss/i })).toHaveCount(0);
    await expect(page.locator(".billing-kpi-grid")).toBeVisible();
    await expect(page.locator(".billing-currency-summary")).toContainText("SYP");
    await expect(page.locator(".billing-currency-summary")).toContainText("USD");
    await expectNoDocumentOverflow(page);
  });

  test("Staff overview exposes operational creation and exact recent invoice navigation", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await login(page, "staff");
    const recentResponse = page.waitForResponse((response) => new URL(response.url()).pathname.endsWith("/api/invoices/") && response.request().method() === "GET" && response.ok());
    await page.goto("/staff/billing/overview");
    const recentPayload = await (await recentResponse).json() as { results: { id: number; invoice_number: string }[] };
    await expect(page.getByRole("link", { name: "New invoice" })).toHaveAttribute("href", "/staff/billing/invoices/new");
    await expect(page.getByText("Collected today")).toBeVisible();
    if (recentPayload.results.length) {
      const invoice = recentPayload.results[0];
      await page.getByRole("row", { name: new RegExp(invoice.invoice_number) }).first().click();
      await expect(page).toHaveURL(new RegExp(`/staff/billing/invoices/${invoice.id}$`));
    } else {
      await expect(page.getByText("No invoices found.").first()).toBeVisible();
    }
    await expectNoDocumentOverflow(page);
  });

  test("Invoice history uses backend clinic date presets and combined URL filters", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page, "staff");
    const summaryResponse = page.waitForResponse((response) => new URL(response.url()).pathname.endsWith("/api/invoices/summary/") && response.ok());
    await page.goto("/staff/billing/invoices?page=2");
    const summary = await (await summaryResponse).json() as { clinic_date: string };
    await expect(page.getByRole("heading", { name: "Invoice history" })).toBeVisible();
    await page.getByRole("button", { name: "Today" }).click();
    await expect(page).toHaveURL(new RegExp(`date_from=${summary.clinic_date}.*date_to=${summary.clinic_date}`));
    await expect(page).not.toHaveURL(/page=2/);
    await page.getByRole("searchbox", { name: "Search" }).fill("INV-");
    await page.getByRole("combobox", { name: "Status" }).selectOption("UNPAID");
    await page.getByRole("combobox", { name: "Currency" }).selectOption("SYP");
    await expect(page).toHaveURL(/search=INV-/);
    await expect(page).toHaveURL(/status=UNPAID/);
    await expect(page).toHaveURL(/currency=SYP/);
    for (const column of ["Invoice", "Patient", "Date", "Total", "Paid", "Balance", "Status"]) await expect(page.getByRole("columnheader", { name: column, exact: true })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Related visit" })).toHaveCount(0);
    await expectNoDocumentOverflow(page);
  });

  test("Billing remains token-themed, compact, responsive, and RTL-safe", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await login(page, "admin");
    await page.goto("/admin/billing/invoices");
    if (await page.locator("html").getAttribute("data-theme") !== "light") {
      await page.locator(".theme-toggle").click();
      await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    }
    const light = await page.locator(".billing-date-filter-card").evaluate((element) => ({ background: getComputedStyle(element).backgroundColor, color: getComputedStyle(element).color }));
    await page.locator(".theme-toggle").click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    const dark = await page.locator(".billing-date-filter-card").evaluate((element) => ({ background: getComputedStyle(element).backgroundColor, color: getComputedStyle(element).color }));
    expect(dark).not.toEqual(light);
    await page.getByRole("button", { name: "AR", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: "سجل الفواتير" })).toBeVisible();
    await expect(page.getByRole("link", { name: "نظرة عامة" })).toBeVisible();
    await expect(page.locator(".billing-table .bidi-ltr").first()).toHaveCSS("direction", "ltr");
    await expectNoDocumentOverflow(page);
  });

  test("Doctor retains handoffs only and cannot reach invoice UI or API", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await login(page, "doctor");
    const invoiceRequests: string[] = [];
    page.on("request", (request) => { if (new URL(request.url()).pathname.startsWith("/api/invoices")) invoiceRequests.push(request.url()); });
    await page.goto("/doctor/billing/invoices");
    await expect(page.getByRole("heading", { name: /not found/i })).toBeVisible();
    expect(invoiceRequests).toHaveLength(0);
    await page.goto("/doctor/billing/handoffs");
    await expect(page.getByRole("heading", { name: "My Billing Handoffs" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Overview" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Invoices" })).toHaveCount(0);
    await expectNoDocumentOverflow(page);
  });
});
