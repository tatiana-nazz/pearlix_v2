import { expect, test, type Page } from "@playwright/test";

const password = process.env.PEARLIX_E2E_PASSWORD;

const accounts = {
  admin: "admin@pearlix-demo.local",
  staff: "staff.one@pearlix-demo.local",
  doctor: "doctor.one@pearlix-demo.local",
} as const;

async function login(page: Page, email: string) {
  if (!password) throw new Error("PEARLIX_E2E_PASSWORD must be set for the local demo account.");
  await page.goto("/");
  expect(new URL(page.url()).origin).toBe("http://127.0.0.1:5173");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("Admin can reach the dashboard, Team, and Users & Access", async ({ page }) => {
  await login(page, accounts.admin);
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
  await page.goto("/admin/team");
  await expect(page).toHaveURL(/\/admin\/team$/);
  await expect(page.locator("#root")).not.toBeEmpty();
  await page.goto("/admin/users");
  await expect(page).toHaveURL(/\/admin\/users$/);
  await expect(page.locator("#root")).not.toBeEmpty();
});

test("Staff can reach appointment scheduling and the patient directory", async ({ page }) => {
  const failures: string[] = [];
  const consoleErrors: string[] = [];
  page.on("requestfailed", (request) => failures.push(request.url()));
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  await login(page, accounts.staff);
  await expect(page).toHaveURL(/\/staff\/dashboard$/);
  expect(failures).toEqual([]);
  expect(consoleErrors).toEqual([]);
  await page.goto("/staff/appointments/day");
  await expect(page).toHaveURL(/\/staff\/appointments\/day$/);
  await expect(page.locator("#root")).not.toBeEmpty();
  await page.goto("/staff/patients");
  await expect(page).toHaveURL(/\/staff\/patients$/);
  await expect(page.locator("#root")).not.toBeEmpty();
});

test("Doctor workspace omits administrative patient actions", async ({ page }) => {
  await login(page, accounts.doctor);
  await expect(page).toHaveURL(/\/doctor\/dashboard$/);
  await page.goto("/doctor/patients");
  await expect(page).toHaveURL(/\/doctor\/patients$/);
  await expect(page.locator("#root")).not.toBeEmpty();
  await expect(page.locator('a[href="/doctor/patients/new"]')).toHaveCount(0);
});
