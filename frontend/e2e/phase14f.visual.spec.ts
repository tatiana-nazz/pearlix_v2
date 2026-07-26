import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

const password = process.env.PEARLIX_E2E_PASSWORD;
const evidenceDir = process.env.PHASE14F_EVIDENCE_DIR;

const accounts = {
  admin: "admin@pearlix-demo.local",
  staff: "staff.one@pearlix-demo.local",
  doctor: "doctor.three@pearlix-demo.local",
} as const;

async function login(page: Page, email: string) {
  if (!password) throw new Error("PEARLIX_E2E_PASSWORD must be set for the local demo account.");
  await page.goto("/");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/(admin|staff|doctor)\/dashboard$/);
}

async function capture(page: Page, name: string) {
  if (!evidenceDir) return;
  await page.screenshot({ path: path.join(evidenceDir, `${name}.png`), fullPage: true });
}

function diagnostics(page: Page) {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  const httpErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("requestfailed", (request) => failedRequests.push(request.url()));
  page.on("response", (response) => {
    if (response.status() >= 400) httpErrors.push(`${response.status()} ${response.url()}`);
  });
  return { consoleErrors, failedRequests, httpErrors };
}

test("Phase 14F shell and route surfaces use the supplied desktop visual system", async ({ page }) => {
  const issues = diagnostics(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await login(page, accounts.admin);
  await expect(page).toHaveURL(/\/admin\/dashboard$/);

  const visualContract = await page.evaluate(() => {
    const sidebar = document.querySelector(".app-sidebar");
    const header = document.querySelector(".workspace-header");
    return {
      sidebarWidth: sidebar ? getComputedStyle(sidebar).width : null,
      headerHeight: header ? getComputedStyle(header).height : null,
      cardRadius: getComputedStyle(document.documentElement).getPropertyValue("--v2-radius-card").trim(),
      pageBackground: getComputedStyle(document.documentElement).getPropertyValue("--v2-canvas").trim(),
    };
  });
  expect(visualContract).toEqual({
    sidebarWidth: "264px",
    headerHeight: "68px",
    cardRadius: "20px",
    pageBackground: "#f6f8fc",
  });
  await capture(page, "after-admin-dashboard");

  await page.goto("/admin/team");
  await expect(page.getByRole("heading", { name: "Team", exact: true })).toBeVisible();
  await capture(page, "after-admin-team-directory");
  await page.getByText("Dr. Samir Nasser", { exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/team\/\d+$/);
  await expect(page.getByRole("heading", { name: "Working hours" })).toBeVisible();
  await capture(page, "after-admin-team-member-detail");

  await page.goto("/admin/users");
  await expect(page.getByRole("heading", { name: "Users & Access" })).toBeVisible();
  await capture(page, "after-admin-users-access");
  expect(issues.consoleErrors).toEqual([]);
  expect(issues.failedRequests).toEqual([]);
  expect(issues.httpErrors).toEqual([]);
});

test("Staff visual acceptance covers appointments, profile, patient, and payment workflow", async ({ page }) => {
  const issues = diagnostics(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await login(page, accounts.staff);
  await expect(page).toHaveURL(/\/staff\/dashboard$/);
  await capture(page, "after-staff-dashboard");

  await page.goto("/staff/appointments/week");
  await expect(page.getByRole("heading", { name: "Appointments", exact: true })).toBeVisible();
  await expect(page.getByText("Week summary")).toBeVisible();
  await capture(page, "after-staff-appointments-week");

  await page.goto("/staff/profile");
  await expect(page.getByRole("heading", { name: "Profile", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Working hours / shifts", exact: true })).toBeVisible();
  await capture(page, "after-staff-profile");

  await page.goto("/staff/patients/1032");
  await expect(page.locator(".profile-header").getByRole("heading", { name: "Dania Farhat", exact: true })).toBeVisible();
  await capture(page, "after-staff-patient-profile");

  await page.goto("/staff/billing/invoices");
  await page.getByText("INV-20260726-000044", { exact: true }).click();
  await expect(page).toHaveURL(/\/staff\/billing\/invoices\/\d+$/);
  await expect(page.getByRole("button", { name: "Record payment" })).toBeVisible();
  await capture(page, "after-staff-invoice-payment");
  expect(issues.consoleErrors).toEqual([]);
  expect(issues.failedRequests).toEqual([]);
  expect(issues.httpErrors).toEqual([]);
});

test("Doctor visual acceptance covers appointments, active visit, and protected X-ray AI", async ({ page }) => {
  const issues = diagnostics(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await login(page, accounts.doctor);
  await expect(page).toHaveURL(/\/doctor\/dashboard$/);
  await capture(page, "after-doctor-dashboard");

  await page.goto("/doctor/appointments/week");
  await expect(page.getByRole("heading", { name: "Appointments", exact: true })).toBeVisible();
  await capture(page, "after-doctor-appointments-week");

  await page.goto("/doctor/visits/active");
  await expect(page.getByRole("heading", { name: "Active visit", exact: true })).toBeVisible();
  await capture(page, "after-doctor-active-visit");

  await page.goto("/doctor/xrays");
  await page.getByRole("row", { name: "Synthetic demo X-ray with mock AI. Hala Sabbagh. Result available." }).click();
  await expect(page).toHaveURL(/\/doctor\/xrays\/\d+$/);
  const protectedImage = page.getByRole("img", { name: "Protected dental X-ray for clinical review" });
  await expect(protectedImage).toBeVisible();
  expect(await protectedImage.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await expect(page.getByText("74%")).toBeVisible();
  await capture(page, "after-doctor-protected-xray-ai");
  expect(issues.consoleErrors).toEqual([]);
  expect(issues.failedRequests).toEqual([]);
  expect(issues.httpErrors).toEqual([]);
});

test("Responsive shell, RTL, and dark mode remain usable at frozen breakpoints", async ({ page }) => {
  const issues = diagnostics(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await login(page, accounts.staff);
  await page.goto("/staff/appointments/week");

  await page.setViewportSize({ width: 1023, height: 900 });
  await expect(page.getByRole("button", { name: "Open navigation" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await capture(page, "after-tablet-appointments");

  await page.getByRole("button", { name: "AR", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await capture(page, "after-tablet-appointments-rtl");
  await page.getByRole("button", { name: "EN", exact: true }).click();

  await page.setViewportSize({ width: 767, height: 900 });
  await expect(page.getByRole("button", { name: "Open navigation" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await capture(page, "after-mobile-appointments");

  const themeButton = page.locator(".theme-toggle");
  await themeButton.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await capture(page, "after-mobile-appointments-dark");
  await themeButton.click();
  expect(issues.consoleErrors).toEqual([]);
  expect(issues.failedRequests).toEqual([]);
  expect(issues.httpErrors).toEqual([]);
});
