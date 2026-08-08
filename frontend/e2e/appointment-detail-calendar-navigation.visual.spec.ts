import { expect, test, type Page } from "@playwright/test";

const password = process.env.PEARLIX_E2E_PASSWORD;

async function login(page: Page, email: string, expectedRole: "admin" | "staff" | "doctor") {
  if (!password) throw new Error("PEARLIX_E2E_PASSWORD must be set.");
  await page.goto("/login");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(new RegExp(`/${expectedRole}/dashboard$`));
  const english = page.getByRole("button", { name: "EN", exact: true });
  if (await english.getAttribute("aria-pressed") !== "true") await english.click();
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function displayedDateToInput(value: string) {
  const parts = value.split("·");
  const parsed = new Date(parts[parts.length - 1]?.trim() ?? value);
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function expectNoDocumentOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
}

async function monthStatusStyle(page: Page, status: string, tone: string) {
  const item = page.locator(`.appointment-month-item[data-status="${status}"]`).first();
  await expect(item).toBeVisible();
  await expect(item).toHaveClass(new RegExp(`status-${tone}`));
  const structure = await item.evaluate((element) => ({
    accent: getComputedStyle(element).borderInlineStartColor,
    background: getComputedStyle(element).backgroundColor,
    time: Boolean(element.querySelector(".appointment-month-time")),
    patient: Boolean(element.querySelector(".appointment-month-patient")),
    status: Boolean(element.querySelector(".appointment-month-status")),
    contained: element.scrollWidth <= element.clientWidth + 1 && element.scrollHeight <= element.clientHeight + 1,
  }));
  expect(structure).toMatchObject({ time: true, patient: true, status: true, contained: true });
  return structure;
}

test("appointment detail navigation, calendar drilldown, role actions, and responsive layout", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page, "admin@pearlix-demo.local", "admin");
  const referenceDate = displayedDateToInput(await page.locator(".dashboard-v2-date").innerText());

  const dashboardAppointment = page.locator(".dashboard-v2-primary .dashboard-v2-list a").first();
  await expect(dashboardAppointment).toBeVisible();
  const detailResponse = page.waitForResponse((response) => /\/api\/appointments\/\d+\/$/.test(new URL(response.url()).pathname) && response.request().method() === "GET");
  await dashboardAppointment.click();
  const detailPayload = await (await detailResponse).json() as { id: number; start_datetime: string };
  await expect(page).toHaveURL(/\/admin\/appointments\/\d+$/);
  const adminDetailPath = new URL(page.url()).pathname;
  const detail = page.locator(".appointment-detail-page");
  await expect(detail).toBeVisible();
  const appointmentId = String(detailPayload.id);
  const appointmentDate = detailPayload.start_datetime.slice(0, 10);
  expect(adminDetailPath).toBe(`/admin/appointments/${appointmentId}`);
  expect(appointmentDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  for (const label of ["Patient", "Doctor", "Date", "Start time", "End time", "Status", "Reason"]) {
    await expect(page.locator(".appointment-detail-facts dt", { hasText: label }).first()).toBeVisible();
  }
  for (const action of ["Edit", "Reschedule", "Check in", "Mark no-show", "Cancel", "Start visit"]) {
    await expect(page.getByRole("button", { name: action })).toHaveCount(0);
  }

  await page.goto(`/admin/appointments/week?date=${referenceDate}`);
  const weekAppointment = page.locator(".appointment-calendar-item").first();
  await expect(weekAppointment).toBeVisible();
  await weekAppointment.click();
  await expect(page).toHaveURL(/\/admin\/appointments\/\d+$/);
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/admin/appointments/week\\?date=${referenceDate}`));
  const emptyWeekDay = page.locator(".appointment-calendar-column").filter({ hasNot: page.locator(".appointment-calendar-item") }).first();
  await expect(emptyWeekDay).toBeVisible();
  const weekDay = await emptyWeekDay.getAttribute("data-date");
  await emptyWeekDay.dblclick({ position: { x: 50, y: 150 } });
  await expect(page).toHaveURL(new RegExp(`/admin/appointments/day\\?.*date=${weekDay}`));

  const warningDate = addDays(referenceDate, 3);
  const cancelledDate = addDays(referenceDate, 5);
  await page.goto(`/admin/appointments/month?date=${referenceDate}`);
  const upcomingStyle = await monthStatusStyle(page, "UPCOMING", "info");
  await page.goto(`/admin/appointments/month?date=${warningDate}`);
  const warningStyle = await monthStatusStyle(page, "NEEDS_RESCHEDULE", "warning");
  await page.goto(`/admin/appointments/month?date=${cancelledDate}`);
  const dangerStyle = await monthStatusStyle(page, "CANCELLED", "danger");
  expect(new Set([upcomingStyle.accent, warningStyle.accent, dangerStyle.accent]).size).toBe(3);
  expect(new Set([upcomingStyle.background, warningStyle.background, dangerStyle.background]).size).toBe(3);

  const monthAppointment = page.locator(".appointment-month-item").first();
  await monthAppointment.click();
  await expect(page).toHaveURL(/\/admin\/appointments\/\d+$/);
  await page.goBack();
  const emptyMonthDay = page.locator(".appointment-month-cell").filter({ hasNot: page.locator(".appointment-month-item") }).first();
  await expect(emptyMonthDay).toBeVisible();
  const monthDay = await emptyMonthDay.getAttribute("data-date");
  await emptyMonthDay.dblclick({ position: { x: 50, y: 140 } });
  await expect(page).toHaveURL(new RegExp(`/admin/appointments/day\\?.*date=${monthDay}`));

  await page.goto(adminDetailPath);
  await page.locator(".appointment-detail-facts").getByRole("link").click();
  await expect(page).toHaveURL(/\/admin\/patients\/\d+$/);
  await page.getByRole("tab", { name: "Appointments" }).click();
  const patientAppointment = page.getByRole("link", { name: "Open appointment" }).first();
  await expect(patientAppointment).toBeVisible();
  const patientAppointmentHref = await patientAppointment.getAttribute("href");
  await patientAppointment.click();
  await expect(page).toHaveURL(new RegExp(`${patientAppointmentHref}$`));

  await page.goto(adminDetailPath);
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1280, height: 720 }, { width: 1024, height: 768 }]) {
    await page.setViewportSize(viewport);
    await expect(detail).toBeVisible();
    await expect(page.locator(".appointment-detail-header-actions")).toBeVisible();
    await expectNoDocumentOverflow(page);
  }

  await login(page, "staff.one@pearlix-demo.local", "staff");
  await page.goto(`/staff/appointments/${appointmentId}`);
  await expect(page.getByRole("button", { name: "Edit" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Reschedule" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start visit" })).toHaveCount(0);

  await login(page, "doctor.one@pearlix-demo.local", "doctor");
  await page.goto(`/doctor/appointments/week?date=${warningDate}`);
  const doctorAppointment = page.locator(".appointment-calendar-item").first();
  await expect(doctorAppointment).toBeVisible();
  await doctorAppointment.click();
  await expect(page).toHaveURL(/\/doctor\/appointments\/\d+$/);
  for (const action of ["Edit", "Reschedule", "Check in", "Mark no-show", "Cancel"]) {
    await expect(page.getByRole("button", { name: action })).toHaveCount(0);
  }
  await expectNoDocumentOverflow(page);
});
