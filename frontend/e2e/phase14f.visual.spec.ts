import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

const password = process.env.PEARLIX_E2E_PASSWORD;
const evidenceDir = process.env.PHASE14F_EVIDENCE_DIR;

const accounts = {
  admin: "admin@pearlix-demo.local",
  staff: "staff.one@pearlix-demo.local",
  doctor: "doctor.one@pearlix-demo.local",
} as const;

async function login(page: Page, email: string) {
  if (!password) throw new Error("PEARLIX_E2E_PASSWORD must be set for the local demo account.");
  await page.goto("/");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/(admin|staff|doctor)\/dashboard$/);
  const english = page.getByRole("button", { name: "EN", exact: true });
  if (await english.getAttribute("aria-pressed") !== "true") await english.click();
  if (await page.locator("html").getAttribute("data-theme") !== "light") await page.locator(".theme-toggle").click();
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
  await page.goto("/admin/clinic-settings");
  for (const title of ["Clinic identity", "Scheduling defaults", "Locale and currency", "AI operations"]) await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save settings" })).toBeVisible();
  await capture(page, "after-admin-clinic-settings");
  await expect(page.getByRole("link", { name: "Profile", exact: true })).toHaveAttribute("href", "/admin/profile");
  await page.goto("/admin/patients");
  await page.getByLabel("Search", { exact: true }).fill("Amina Khalil");
  await page.getByText("Amina Khalil", { exact: true }).click();
  await expect(page.getByRole("button", { name: "Edit", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Archive|Reactivate/ })).toHaveCount(0);
  expect(issues.consoleErrors).toEqual([]);
  expect(issues.failedRequests).toEqual([]);
  expect(issues.httpErrors).toEqual([]);
});

test("Staff visual acceptance covers appointments, profile, patient, and payment workflow", async ({ page }) => {
  const issues = diagnostics(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await login(page, accounts.staff);
  await expect(page).toHaveURL(/\/staff\/dashboard$/);
  await expect(page.getByRole("button", { name: "Refresh" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "New appointment" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "New patient" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "My Profile" })).toHaveCount(1);
  await expect(page.getByRole("link", { name: "My Schedule" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "My Leave" })).toHaveCount(0);
  await capture(page, "after-staff-dashboard");

  await page.goto("/staff/appointments/week");
  await expect(page.getByRole("heading", { name: "Appointments", exact: true })).toBeVisible();
  await expect(page.getByText("Week summary")).toBeVisible();
  for (const label of ["Day", "Week", "Month", "List", "Calendar", "Reschedule Queue"]) await expect(page.getByRole("link", { name: label, exact: true })).toBeVisible();
  await capture(page, "after-staff-appointments-week");

  await page.getByRole("link", { name: "Month", exact: true }).click();
  await expect(page).toHaveURL(/\/staff\/appointments\/month/);
  await capture(page, "after-staff-appointments-month");
  await page.getByRole("link", { name: "Reschedule Queue", exact: true }).click();
  await expect(page).toHaveURL(/\/staff\/appointments\/needs-reschedule/);
  await page.goBack();
  await expect(page).toHaveURL(/\/staff\/appointments\/month/);
  await page.goForward();
  await expect(page).toHaveURL(/\/staff\/appointments\/needs-reschedule/);
  await expect(page.getByText("Demo approved leave").first()).toBeVisible();
  await capture(page, "after-staff-reschedule-queue");

  await page.goto("/staff/profile");
  await expect(page.getByRole("heading", { name: "Profile", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Working hours / shifts", exact: true })).toBeVisible();
  await capture(page, "after-staff-profile");

  await page.goto("/staff/patients");
  await page.getByLabel("Search", { exact: true }).fill("Dania Farhat");
  await page.getByText("Dania Farhat", { exact: true }).click();
  await expect(page.locator(".profile-header").getByRole("heading", { name: "Dania Farhat", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Edit patient" })).toBeVisible();
  await expect(page.getByLabel(/First name/)).toHaveValue("Dania");
  await page.getByLabel("Phone", { exact: true }).fill("+963-93-1400023");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("+963-93-1400023", { exact: true }).first()).toBeVisible();
  await capture(page, "after-staff-patient-profile");

  await page.goto("/staff/billing/invoices");
  await page.getByText("Bassam Salloum", { exact: true }).click();
  await expect(page).toHaveURL(/\/staff\/billing\/invoices\/\d+$/);
  await expect(page.getByRole("button", { name: "Record payment" })).toBeVisible();
  await capture(page, "after-staff-invoice-payment");
  expect(issues.consoleErrors).toEqual([]);
  expect(issues.failedRequests).toEqual([]);
  expect(issues.httpErrors).toEqual([]);
});

test("Real API appointment actions remain connected through corrected detail-first UI", async ({ page }) => {
  test.setTimeout(60_000);
  const issues = diagnostics(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await login(page, accounts.staff);

  await page.goto("/staff/appointments/day");
  await page.getByRole("button", { name: "New appointment", exact: true }).click();
  await page.getByRole("combobox", { name: "Patient" }).fill("Riad Hakim");
  await page.getByRole("option", { name: /Riad Hakim/ }).click();
  const appointmentDialog = page.locator(".v2-overlay").filter({ hasText: "New appointment" });
  await appointmentDialog.locator("select").selectOption({ label: "Dr. Yasmin Barakat" });
  await appointmentDialog.locator('input[type="date"]').fill("2026-08-01");
  await appointmentDialog.locator('input[type="time"]').fill("16:00");
  await appointmentDialog.locator("label").filter({ hasText: "Reason" }).locator("input").fill("E2E created appointment");
  await appointmentDialog.getByRole("button", { name: "Save appointment" }).click();
  await expect(page.getByRole("dialog", { name: "New appointment" })).toHaveCount(0);
  await page.goto("/staff/appointments/list?search=Riad");
  await expect(page.getByText("E2E created appointment", { exact: true })).toBeVisible();

  await page.goto("/staff/appointments/needs-reschedule");
  await page.getByRole("row", { name: /Mira Sayegh Dr\. Samir Nasser/ }).click();
  await page.getByRole("button", { name: "Reschedule", exact: true }).click();
  await page.getByRole("button", { name: /8:30 AM - 9:00 AM 0\/3 booked/ }).click();
  await page.getByRole("button", { name: "Save reschedule" }).click();
  await expect(page).toHaveURL(/\/staff\/appointments\/needs-reschedule/);
  await expect(page.getByText("2 records", { exact: true })).toBeVisible();

  await page.goto("/staff/appointments/day?date=2026-07-26");
  await page.getByRole("row", { name: /Amina Khalil/ }).click();
  for (const action of ["Check in", "Mark no-show", "Cancel"]) await expect(page.getByRole("button", { name: action, exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();

  await page.getByRole("button", { name: "Logout" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await login(page, "doctor.two@pearlix-demo.local");
  await page.goto("/doctor/appointments/day?date=2026-07-24");
  await page.getByRole("row", { name: /Karim Azzam/ }).click();
  await page.getByRole("button", { name: "Start visit", exact: true }).click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(page).toHaveURL(/\/doctor\/visits\/active/);
  await expect(page.getByRole("heading", { name: "Karim Azzam", exact: true }).first()).toBeVisible();
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
  await page.getByRole("link", { name: "Month", exact: true }).click();
  await expect(page).toHaveURL(/\/doctor\/appointments\/month/);

  await page.goto("/doctor/visits/active");
  await expect(page.getByRole("heading", { name: "Lina Mansour", exact: true }).first()).toBeVisible();
  await capture(page, "after-doctor-active-visit");

  await page.goto("/doctor/xrays");
  await page.getByRole("row", { name: "Active visit panoramic X-ray with mock AI. Lina Mansour. Result available." }).click();
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
