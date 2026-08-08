import { expect, test, type Page } from "@playwright/test";

import type { AdminDashboardResponse, DoctorDashboardResponse, StaffDashboardResponse } from "../src/types/dashboard";

const password = process.env.PEARLIX_E2E_PASSWORD;
type Role = "admin" | "staff" | "doctor";

async function login(page: Page, role: Role, email: string) {
  if (!password) throw new Error("PEARLIX_E2E_PASSWORD must be set.");
  const responsePromise = page.waitForResponse((response) => new URL(response.url()).pathname.endsWith(`/api/dashboard/${role}/`) && response.request().method() === "GET" && response.ok());
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(new RegExp(`/${role}/dashboard$`));
  const english = page.getByRole("button", { name: "EN", exact: true });
  if (await english.getAttribute("aria-pressed") !== "true") await english.click();
  return (await responsePromise).json();
}

async function resetSession(page: Page) {
  await page.evaluate(() => localStorage.clear());
  await page.context().clearCookies();
}

async function expectContained(page: Page) {
  await expect(page.locator(".dashboard-v2")).toBeVisible();
  const geometry = await page.locator(".dashboard-v2").evaluate((dashboard) => {
    const root = dashboard.getBoundingClientRect();
    const cards = Array.from(dashboard.querySelectorAll<HTMLElement>(".v2-card"));
    return {
      noDocumentOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
      cardsContained: cards.every((card) => {
        const rect = card.getBoundingClientRect();
        return rect.left >= root.left - 1 && rect.right <= root.right + 1;
      }),
    };
  });
  expect(geometry).toEqual({ noDocumentOverflow: true, cardsContained: true });
}

test.describe("role dashboard redesign", () => {
  test("admin dashboard supervisory workspace", async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    const data = await login(page, "admin", "admin@pearlix-demo.local") as AdminDashboardResponse;
    await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
    for (const label of ["Today's appointments", "Active visits", "Needs reschedule", "Pending handoffs", "Open invoices"]) await expect(page.locator(".dashboard-v2-metrics").getByText(label, { exact: true })).toBeVisible();
    await expect(page.getByText("Quick actions", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Add team member" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Create user" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Appointments by status" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Billing activity" })).toBeVisible();
    await expect(page.locator(".dashboard-v2-currency-chart")).toHaveCount(2);
    await expect(page.locator(".dashboard-v2-currency-chart").filter({ hasText: "SYP" })).toBeVisible();
    await expect(page.locator(".dashboard-v2-currency-chart").filter({ hasText: "USD" })).toBeVisible();
    if (data.today_appointments.length) {
      const selected = data.today_appointments[0];
      const link = page.getByRole("link", { name: new RegExp(`Open appointment ${selected.id}:`) }).first();
      await expect(link).toHaveAttribute("href", `/admin/appointments/${selected.id}`);
    } else await expect(page.getByText("No appointments scheduled today.")).toBeVisible();
    if (data.recent_invoices.length) {
      const selected = data.recent_invoices[0];
      await expect(page.getByRole("link", { name: new RegExp(`Invoice ${selected.invoice_number}:`) })).toHaveAttribute("href", `/admin/billing/invoices/${selected.id}`);
    }
    await expectContained(page);
  });

  test("staff dashboard operational queue", async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    const data = await login(page, "staff", "staff.one@pearlix-demo.local") as StaffDashboardResponse;
    await expect(page.getByRole("heading", { name: "Staff dashboard" })).toBeVisible();
    await expect(page.getByRole("link", { name: "New appointment" })).toBeVisible();
    await expect(page.getByRole("link", { name: "New patient" })).toBeVisible();
    for (const label of ["Today's appointments", "Patients ready", "Needs reschedule", "Pending billing"]) await expect(page.locator(".dashboard-v2-metrics").getByText(label, { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Today's appointment queue" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Attention required" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Open invoices / Billing follow-up" })).toBeVisible();
    await expect(page.getByText("Quick actions", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Billing activity" })).toHaveCount(0);
    if (data.today_appointments.length) {
      const selected = data.today_appointments[0];
      await expect(page.getByRole("link", { name: new RegExp(`Open appointment ${selected.id}:`) })).toHaveAttribute("href", `/staff/appointments/${selected.id}`);
    } else await expect(page.getByText("No appointments scheduled today.")).toBeVisible();
    if (data.open_invoices.length) {
      const selected = data.open_invoices[0];
      await expect(page.getByRole("link", { name: new RegExp(`Invoice ${selected.invoice_number}:`) })).toHaveAttribute("href", `/staff/billing/invoices/${selected.id}`);
    } else await expect(page.getByText("No open invoices need follow-up.")).toBeVisible();
    await expectContained(page);
  });

  test("doctor dashboard clinical workspace", async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    const data = await login(page, "doctor", "doctor.one@pearlix-demo.local") as DoctorDashboardResponse;
    await expect(page.getByRole("heading", { name: "Doctor dashboard" })).toBeVisible();
    for (const label of ["Today's appointments", "Patients ready", "Completed today", "Needs reschedule"]) await expect(page.locator(".dashboard-v2-metrics").getByText(label, { exact: true })).toBeVisible();
    await expect(page.getByText("Quick actions", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Billing activity" })).toHaveCount(0);
    if (data.own_active_visit) await expect(page.getByRole("link", { name: "Continue visit" }).first()).toHaveAttribute("href", "/doctor/visits/active");
    else await expect(page.getByText("No active visit.")).toBeVisible();
    if (data.today_appointments.length) {
      const selected = data.today_appointments[0];
      await expect(page.getByRole("link", { name: new RegExp(`Open appointment ${selected.id}:`) }).first()).toHaveAttribute("href", `/doctor/appointments/${selected.id}`);
    } else await expect(page.getByText("No appointments scheduled today.")).toBeVisible();
    const next = data.today_appointments.find((item) => item.status === "CHECKED_IN") ?? data.today_appointments.find((item) => item.status === "UPCOMING");
    if (next) await expect(page.locator(".dashboard-v2-next-focus")).toContainText(next.patient.full_name);
    else await expect(page.getByText("No more scheduled patients today.")).toBeVisible();
    await expectContained(page);
  });

  test("dashboard light dark and rtl themes", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1280, height: 720 });
    await login(page, "admin", "admin@pearlix-demo.local");
    if (await page.locator("html").getAttribute("data-theme") !== "light") await page.locator(".theme-toggle").click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expectContained(page);
    await page.locator(".theme-toggle").click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.locator(".dashboard-v2-status-chart")).toBeVisible();
    await expectContained(page);
    await page.getByRole("button", { name: "AR", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: "نشاط الفوترة" })).toBeVisible();
    await expectContained(page);

    await resetSession(page);
    await login(page, "doctor", "doctor.one@pearlix-demo.local");
    if (await page.locator("html").getAttribute("data-theme") !== "dark") await page.locator(".theme-toggle").click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expectContained(page);
  });

  test("dashboard responsive layouts", async ({ page }) => {
    test.setTimeout(90_000);
    const viewports = [{ width: 1440, height: 900 }, { width: 1280, height: 720 }, { width: 1024, height: 768 }];
    await login(page, "admin", "admin@pearlix-demo.local");
    for (const viewport of viewports) { await page.setViewportSize(viewport); await expectContained(page); await expect(page.locator(".dashboard-v2-chart-card")).toHaveCount(2); }
    await resetSession(page); await login(page, "staff", "staff.one@pearlix-demo.local");
    for (const viewport of viewports) { await page.setViewportSize(viewport); await expectContained(page); }
    await resetSession(page); await login(page, "doctor", "doctor.one@pearlix-demo.local");
    for (const viewport of viewports) { await page.setViewportSize(viewport); await expectContained(page); }
  });
});
