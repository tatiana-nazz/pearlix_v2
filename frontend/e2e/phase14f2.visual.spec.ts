import { expect, test, type Page } from "@playwright/test";

const password = process.env.PEARLIX_E2E_PASSWORD;
const accounts = { admin: "admin@pearlix-demo.local", staff: "staff.one@pearlix-demo.local", doctor: "doctor.one@pearlix-demo.local" } as const;

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

const noDocumentOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

test("Staff IA, profile semantics, Team projection, and unified Billing are closed", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await login(page, accounts.staff);
  const sidebar = page.locator(".v2-nav-link");
  await expect(sidebar).toHaveText(["Dashboard", "Appointments", "Patients", "Team", "X-rays & AI", "Billing", "My Profile"]);

  await page.goto("/staff/profile");
  await expect(page.locator(".schedule-matrix")).toBeVisible();
  await expect(page.locator(".schedule-matrix thead th")).toHaveText(["Shift", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]);
  await expect(page.locator(".leave-exceptions-table")).toBeVisible();
  await expect(page.locator(".leave-exceptions-table thead th")).toHaveText(["Date / Time", "Reason", "Type", "Status"]);

  await page.goto("/staff/team");
  await expect(page.locator(".team-directory-card")).toHaveCount(11);
  await expect(page.getByRole("link", { name: /Dr\. Samir Nasser/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Add team member/ })).toHaveCount(0);
  await page.getByRole("link", { name: /Pearlix QA Staff/ }).click();
  await expect(page.getByRole("button", { name: /Deactivate|Reactivate|Save professional/ })).toHaveCount(0);
  await expect(page.getByText(/Password state|Login account/)).toHaveCount(0);

  await page.goto("/staff/billing");
  await expect(page).toHaveURL(/\/staff\/billing\/handoffs$/);
  await expect(page.getByRole("heading", { name: "Billing", exact: true })).toBeVisible();
  await expect(page.locator(".billing-workspace-tabs a")).toHaveText(["Handoffs", "Invoices"]);
  expect(await noDocumentOverflow(page)).toBe(true);
});

test("appointment toolbar stays aligned and remembers the calendar view", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await login(page, accounts.staff);
  await page.goto("/staff/appointments/week?date=2026-07-26");
  const toolbarGroups = page.locator(".appointments-date-navigation,.appointment-workspace-tabs,.appointment-tabs");
  await expect(toolbarGroups).toHaveCount(3);
  const geometry = await toolbarGroups.evaluateAll((items) => items.map((item) => ({ top: Math.round(item.getBoundingClientRect().top), height: Math.round(item.getBoundingClientRect().height) })));
  expect(new Set(geometry.map((item) => item.top)).size).toBe(1);
  expect(geometry.every((item) => item.height === 44)).toBe(true);
  await expect(page.getByText("Total in period")).toBeVisible();
  await expect(page.getByText("Status counts for this loaded page")).toBeVisible();
  await page.getByRole("link", { name: "Month", exact: true }).click();
  await expect(page.getByText("Month summary")).toBeVisible();
  await page.getByRole("link", { name: "Reschedule Queue", exact: true }).click();
  for (const label of ["Calendar", "Reschedule Queue", "Day", "Week", "Month", "List"]) await expect(page.getByRole("link", { name: label, exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Calendar", exact: true }).click();
  await expect(page).toHaveURL(/\/staff\/appointments\/month/);
});

test("identity directories and role boundaries remain responsive", async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await login(page, accounts.admin);
  await page.goto("/admin/patients");
  await expect(page.locator(".patient-avatar").first()).toBeVisible();
  await expect(page.locator(".patient-table thead th")).toContainText(["Patient", "Contact", "Gender", "Last visit", "Next appointment"]);
  await page.goto("/admin/users");
  await expect(page.locator(".users-filter-toolbar input,.users-filter-toolbar select")).toHaveCount(3);
  await expect(page.locator(".users-identity-table thead th")).toContainText(["Name", "Email", "Role", "Login status", "Password", "Profile", "Created"]);
  await page.goto("/staff/team");
  await expect(page).toHaveURL(/\/access-denied$/);

  await page.goto("/admin/dashboard");
  await page.getByRole("button", { name: "Logout" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await login(page, accounts.doctor);
  await page.goto("/staff/team");
  await expect(page).toHaveURL(/\/access-denied$/);

  await page.goto("/doctor/dashboard");
  await page.getByRole("button", { name: "Logout" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await login(page, accounts.staff);
  for (const width of [1023, 767]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["/staff/team", "/staff/patients", "/staff/appointments/month", "/staff/profile"]) {
      await page.goto(path);
      expect(await noDocumentOverflow(page), `${path} at ${width}px`).toBe(true);
    }
  }
});
