import { expect, test, type Page } from "@playwright/test";

import { getAppointmentPermissions } from "../src/features/appointments/utils/appointmentPermissions";
import type { AppointmentListItem, AppointmentStatus } from "../src/types/appointments";

const password = process.env.PEARLIX_E2E_PASSWORD;
type AppointmentRole = "admin" | "staff" | "doctor";

async function login(page: Page, email: string, expectedRole: AppointmentRole) {
  if (!password) throw new Error("PEARLIX_E2E_PASSWORD must be set.");
  await page.goto("/login");
  const emailField = page.getByLabel("Email");
  await expect(emailField).toBeVisible();
  await emailField.fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(new RegExp(`/${expectedRole}/dashboard$`));
  const english = page.getByRole("button", { name: "EN", exact: true });
  if (await english.getAttribute("aria-pressed") !== "true") await english.click();
}

function dateOf(appointment: Pick<AppointmentListItem, "start_datetime">) {
  return appointment.start_datetime.slice(0, 10);
}

async function expectNoDocumentOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
}

async function findAppointmentByStatus(page: Page, role: AppointmentRole, status?: AppointmentStatus) {
  const responsePromise = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname.endsWith("/api/appointments/")
      && response.request().method() === "GET"
      && (status ? url.searchParams.get("status") === status : !url.searchParams.has("status"));
  });
  await page.goto(`/${role}/appointments/list${status ? `?status=${status}` : ""}`);
  const payload = await (await responsePromise).json() as { results: AppointmentListItem[] };
  expect(payload.results.length).toBeGreaterThan(0);
  return payload.results[0];
}

async function loadedAppointmentDetail(page: Page, role: AppointmentRole, appointment: AppointmentListItem) {
  const responsePromise = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname.endsWith(`/api/appointments/${appointment.id}/`)
      && response.request().method() === "GET"
      && response.ok();
  });
  await page.goto(`/${role}/appointments/${appointment.id}`);
  await responsePromise;
  await expect(page).toHaveURL(new RegExp(`/${role}/appointments/${appointment.id}$`));
  await expect(page.locator(".appointment-detail-card")).toBeVisible();
  await expect(page.locator(".appointment-detail-header-actions")).toBeVisible();
  return page.locator(".appointment-detail-page");
}

async function expectAppointmentFacts(page: Page) {
  for (const label of ["Patient", "Doctor", "Date", "Start time", "End time", "Status", "Reason"]) {
    await expect(page.locator(".appointment-detail-facts dt", { hasText: label }).first()).toBeVisible();
  }
}

async function expectMonthItemContained(page: Page, appointment: AppointmentListItem, tone: string) {
  const item = page.locator(`.appointment-month-item[data-status="${appointment.status}"][aria-label^="Open appointment ${appointment.id}:"]`);
  await expect(item).toBeVisible();
  await expect(item).toHaveClass(new RegExp(`status-${tone}`));
  for (const selector of [".appointment-month-time", ".appointment-month-patient", ".appointment-month-status"]) {
    await expect(item.locator(selector)).toBeVisible();
  }
  const structure = await item.evaluate((element) => {
    const itemRect = element.getBoundingClientRect();
    const cellRect = element.closest<HTMLElement>(".appointment-month-cell")!.getBoundingClientRect();
    const parts = [".appointment-month-time", ".appointment-month-patient", ".appointment-month-status"]
      .map((selector) => element.querySelector<HTMLElement>(selector));
    const style = getComputedStyle(element);
    const timeRect = parts[0]!.getBoundingClientRect();
    const patientRect = parts[1]!.getBoundingClientRect();
    const statusRect = parts[2]!.getBoundingClientRect();
    const patientStyle = getComputedStyle(parts[1]!);
    const statusStyle = getComputedStyle(parts[2]!);
    const clipsInline = (value: string) => value === "hidden" || value === "clip";
    return {
      accent: style.borderInlineStartColor,
      background: style.backgroundColor,
      time: Boolean(parts[0]),
      patient: Boolean(parts[1]),
      status: Boolean(parts[2]),
      semanticSurface: style.borderInlineStartColor !== "rgba(0, 0, 0, 0)"
        && style.backgroundColor !== "rgba(0, 0, 0, 0)",
      contained: itemRect.left >= cellRect.left - 1
        && itemRect.right <= cellRect.right + 1
        && itemRect.top >= cellRect.top - 1
        && itemRect.bottom <= cellRect.bottom + 1
        && style.overflowX === "hidden"
        && style.overflowY === "hidden"
        && document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
      childrenContained: [timeRect, patientRect, statusRect].every((rect) => rect.left >= itemRect.left - 1
        && rect.right <= itemRect.right + 1
        && rect.top >= itemRect.top - 1
        && rect.bottom <= itemRect.bottom + 1),
      separateLines: patientRect.top >= timeRect.bottom - 1 && statusRect.top >= patientRect.bottom - 1,
      patientClipped: clipsInline(patientStyle.overflowX) && patientStyle.textOverflow === "ellipsis",
      statusClipped: clipsInline(statusStyle.overflowX) && statusStyle.textOverflow === "ellipsis",
    };
  });
  expect(structure).toMatchObject({
    time: true,
    patient: true,
    status: true,
    semanticSurface: true,
    contained: true,
    childrenContained: true,
    separateLines: true,
    patientClipped: true,
    statusClipped: true,
  });
  return structure;
}

async function expectDetailContained(page: Page) {
  await expect(page.locator(".appointment-detail-card")).toBeVisible();
  await expect(page.locator(".appointment-detail-header-actions")).toBeVisible();
  const geometry = await page.locator(".appointment-detail-page").evaluate((detail) => {
    const detailRect = detail.getBoundingClientRect();
    const card = detail.querySelector<HTMLElement>(".appointment-detail-card")!;
    const cardRect = card.getBoundingClientRect();
    const factsContained = Array.from(card.querySelectorAll<HTMLElement>(".appointment-detail-facts > div")).every((fact) => {
      const rect = fact.getBoundingClientRect();
      return rect.left >= cardRect.left - 1 && rect.right <= cardRect.right + 1;
    });
    const actions = detail.querySelector<HTMLElement>(".appointment-detail-header-actions")!;
    const actionRect = actions.getBoundingClientRect();
    return {
      factsContained,
      actionsContained: actionRect.left >= detailRect.left - 1 && actionRect.right <= detailRect.right + 1,
    };
  });
  expect(geometry).toEqual({ factsContained: true, actionsContained: true });
  await expectNoDocumentOverflow(page);
}

async function expectWeekContained(page: Page) {
  const geometry = await page.locator(".appointment-week-grid").evaluate((grid) => {
    const schedule = grid.closest<HTMLElement>(".appointments-schedule-card")!;
    const gridRect = grid.getBoundingClientRect();
    const scheduleRect = schedule.getBoundingClientRect();
    const cardsContained = Array.from(grid.querySelectorAll<HTMLElement>(".appointment-calendar-item")).every((card) => {
      const cardRect = card.getBoundingClientRect();
      const columnRect = card.closest<HTMLElement>(".appointment-calendar-column")!.getBoundingClientRect();
      const style = getComputedStyle(card);
      return cardRect.left >= columnRect.left - 1
        && cardRect.right <= columnRect.right + 1
        && style.overflowX === "hidden"
        && style.overflowY === "hidden";
    });
    return {
      gridContained: gridRect.left >= scheduleRect.left - 1 && gridRect.right <= scheduleRect.right + 1,
      cardsContained,
    };
  });
  expect(geometry).toEqual({ gridContained: true, cardsContained: true });
  await expectNoDocumentOverflow(page);
}

async function expectMonthContained(page: Page) {
  const geometry = await page.locator(".appointment-month-grid").evaluate((grid) => {
    const schedule = grid.closest<HTMLElement>(".appointments-schedule-card")!;
    const gridRect = grid.getBoundingClientRect();
    const scheduleRect = schedule.getBoundingClientRect();
    const cells = Array.from(grid.querySelectorAll<HTMLElement>(".appointment-month-cell"));
    const widths = cells.slice(0, 7).map((cell) => cell.getBoundingClientRect().width);
    const itemsContained = Array.from(grid.querySelectorAll<HTMLElement>(".appointment-month-item")).every((item) => {
      const itemRect = item.getBoundingClientRect();
      const cellRect = item.closest<HTMLElement>(".appointment-month-cell")!.getBoundingClientRect();
      const time = item.querySelector<HTMLElement>(".appointment-month-time")!.getBoundingClientRect();
      const patient = item.querySelector<HTMLElement>(".appointment-month-patient")!.getBoundingClientRect();
      const status = item.querySelector<HTMLElement>(".appointment-month-status")!.getBoundingClientRect();
      return itemRect.left >= cellRect.left - 1
        && itemRect.right <= cellRect.right + 1
        && itemRect.top >= cellRect.top - 1
        && itemRect.bottom <= cellRect.bottom + 1
        && getComputedStyle(item).overflowX === "hidden"
        && getComputedStyle(item).overflowY === "hidden"
        && patient.top >= time.bottom - 1
        && status.top >= patient.bottom - 1;
    });
    return {
      gridContained: gridRect.left >= scheduleRect.left - 1 && gridRect.right <= scheduleRect.right + 1,
      cellsAligned: Math.max(...widths) - Math.min(...widths) <= 1,
      itemsContained,
    };
  });
  expect(geometry).toEqual({ gridContained: true, cellsAligned: true, itemsContained: true });
  await expectNoDocumentOverflow(page);
}

test.describe("appointment detail and calendar navigation", () => {
  test("admin exact appointment navigation and calendar drilldown", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page, "admin@pearlix-demo.local", "admin");

    const dashboardAppointment = page.locator(".dashboard-v2-primary .dashboard-v2-list a").first();
    await expect(dashboardAppointment).toBeVisible();
    const detailResponse = page.waitForResponse((response) => /\/api\/appointments\/\d+\/$/.test(new URL(response.url()).pathname)
      && response.request().method() === "GET"
      && response.ok());
    await dashboardAppointment.click();
    const detailPayload = await (await detailResponse).json() as AppointmentListItem;
    const appointmentId = String(detailPayload.id);
    const selectedAppointmentDate = dateOf(detailPayload);
    const adminDetailPath = `/admin/appointments/${appointmentId}`;
    await expect(page).toHaveURL(new RegExp(`${adminDetailPath}$`));
    await expect(page.locator(".appointment-detail-card")).toBeVisible();
    await expectAppointmentFacts(page);
    for (const action of ["Edit", "Reschedule", "Check in", "Mark no-show", "Cancel", "Start visit"]) {
      await expect(page.getByRole("button", { name: action, exact: true })).toHaveCount(0);
    }

    await page.locator(".appointment-detail-facts").getByRole("link").click();
    await expect(page).toHaveURL(/\/admin\/patients\/\d+$/);
    await page.getByRole("tab", { name: "Appointments" }).click();
    const patientAppointment = page.getByRole("link", { name: "Open appointment" }).first();
    await expect(patientAppointment).toBeVisible();
    const patientAppointmentHref = await patientAppointment.getAttribute("href");
    expect(patientAppointmentHref).toBeTruthy();
    await patientAppointment.click();
    await expect(page).toHaveURL(new RegExp(`${patientAppointmentHref}$`));

    const listAppointment = await findAppointmentByStatus(page, "admin");
    const listRow = page.locator(`[aria-label="Open appointment ${listAppointment.id}"]`);
    await expect(listRow).toBeVisible();
    await listRow.click();
    await expect(page).toHaveURL(new RegExp(`/admin/appointments/${listAppointment.id}$`));

    await page.goto(`/admin/appointments/day?date=${dateOf(listAppointment)}`);
    const dayRow = page.locator(`[aria-label="Open appointment ${listAppointment.id}"]`);
    await expect(dayRow).toBeVisible();
    await dayRow.click();
    await expect(page).toHaveURL(new RegExp(`/admin/appointments/${listAppointment.id}$`));

    const warningAppointment = await findAppointmentByStatus(page, "admin", "NEEDS_RESCHEDULE");
    await page.goto("/admin/appointments/needs-reschedule");
    const warningRow = page.locator(`[aria-label="Open appointment ${warningAppointment.id}"]`);
    await expect(warningRow).toBeVisible();
    await warningRow.click();
    await expect(page).toHaveURL(new RegExp(`/admin/appointments/${warningAppointment.id}$`));

    await page.goto(`/admin/appointments/week?date=${selectedAppointmentDate}`);
    const weekAppointment = page.locator(`.appointment-calendar-item[aria-label^="Open appointment ${appointmentId}:"]`);
    await expect(weekAppointment).toBeVisible();
    await weekAppointment.dispatchEvent("dblclick");
    await expect(page).toHaveURL(new RegExp(`/admin/appointments/week\\?date=${selectedAppointmentDate}`));
    await weekAppointment.click();
    await expect(page).toHaveURL(new RegExp(`${adminDetailPath}$`));
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`/admin/appointments/week\\?date=${selectedAppointmentDate}`));
    const emptyWeekDay = page.locator(".appointment-calendar-column").filter({ hasNot: page.locator(".appointment-calendar-item") }).first();
    await expect(emptyWeekDay).toBeVisible();
    const weekDay = await emptyWeekDay.getAttribute("data-date");
    await emptyWeekDay.dblclick({ position: { x: 50, y: 150 } });
    await expect(page).toHaveURL(new RegExp(`/admin/appointments/day\\?.*date=${weekDay}`));

    const cancelledAppointment = await findAppointmentByStatus(page, "admin", "CANCELLED");
    const cancelledMonthPath = `/admin/appointments/month?date=${dateOf(cancelledAppointment)}&status=CANCELLED`;
    await page.goto(cancelledMonthPath);
    const monthAppointment = page.locator(`.appointment-month-item[aria-label^="Open appointment ${cancelledAppointment.id}:"]`);
    await expect(monthAppointment).toBeVisible();
    await monthAppointment.dispatchEvent("dblclick");
    await expect(page).toHaveURL(new RegExp(`${cancelledMonthPath.replace("?", "\\?")}$`));
    await monthAppointment.click();
    await expect(page).toHaveURL(new RegExp(`/admin/appointments/${cancelledAppointment.id}$`));
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`${cancelledMonthPath.replace("?", "\\?")}$`));
    const emptyMonthDay = page.locator(".appointment-month-cell").filter({ hasNot: page.locator(".appointment-month-item") }).first();
    await expect(emptyMonthDay).toBeVisible();
    const monthDay = await emptyMonthDay.getAttribute("data-date");
    await emptyMonthDay.dblclick({ position: { x: 50, y: 140 } });
    await expect(page).toHaveURL(new RegExp(`/admin/appointments/day\\?.*date=${monthDay}`));

    await page.goto(`/admin/appointments/month?date=${dateOf(cancelledAppointment)}`);
    await expect(page.locator(".appointment-month-grid")).toBeVisible();
    const more = page.locator(".appointment-month-more").first();
    if (await more.count()) {
      const moreDay = await more.locator("xpath=ancestor::section[contains(@class,'appointment-month-cell')]").getAttribute("data-date");
      await more.click();
      await expect(page).toHaveURL(new RegExp(`/admin/appointments/day\\?.*date=${moreDay}`));
    }
    await expectNoDocumentOverflow(page);
  });

  test("month uses shared semantic appointment status presentation", async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page, "admin@pearlix-demo.local", "admin");

    const upcomingAppointment = await findAppointmentByStatus(page, "admin", "UPCOMING");
    await page.goto(`/admin/appointments/month?date=${dateOf(upcomingAppointment)}&status=UPCOMING`);
    const upcomingStyle = await expectMonthItemContained(page, upcomingAppointment, "info");

    const warningAppointment = await findAppointmentByStatus(page, "admin", "NEEDS_RESCHEDULE");
    await page.goto(`/admin/appointments/month?date=${dateOf(warningAppointment)}&status=NEEDS_RESCHEDULE`);
    const warningStyle = await expectMonthItemContained(page, warningAppointment, "warning");

    const cancelledAppointment = await findAppointmentByStatus(page, "admin", "CANCELLED");
    await page.goto(`/admin/appointments/month?date=${dateOf(cancelledAppointment)}&status=CANCELLED`);
    const dangerStyle = await expectMonthItemContained(page, cancelledAppointment, "danger");

    expect(new Set([upcomingStyle.accent, warningStyle.accent, dangerStyle.accent]).size).toBe(3);
    expect(new Set([upcomingStyle.background, warningStyle.background, dangerStyle.background]).size).toBe(3);
  });

  test("appointment detail calendar layouts remain contained", async ({ page }) => {
    test.setTimeout(90_000);
    const viewports = [{ width: 1440, height: 900 }, { width: 1280, height: 720 }, { width: 1024, height: 768 }];
    await login(page, "admin@pearlix-demo.local", "admin");
    const appointment = await findAppointmentByStatus(page, "admin", "UPCOMING");

    await loadedAppointmentDetail(page, "admin", appointment);
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await expectDetailContained(page);
    }

    await page.goto(`/admin/appointments/week?date=${dateOf(appointment)}`);
    const weekAppointment = page.locator(`.appointment-calendar-item[aria-label^="Open appointment ${appointment.id}:"]`);
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await expect(weekAppointment).toBeVisible();
      await expectWeekContained(page);
    }

    await page.goto(`/admin/appointments/month?date=${dateOf(appointment)}&status=UPCOMING`);
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await expectMonthItemContained(page, appointment, "info");
      await expectMonthContained(page);
    }
  });

  test("staff appointment detail exposes only staff-authorized actions", async ({ page }) => {
    test.setTimeout(60_000);
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await login(page, "staff.one@pearlix-demo.local", "staff");
    const appointment = await findAppointmentByStatus(page, "staff", "UPCOMING");
    const detail = await loadedAppointmentDetail(page, "staff", appointment);
    await expect(detail).toHaveAttribute("data-role", "STAFF");
    await expectAppointmentFacts(page);

    const permissions = getAppointmentPermissions("STAFF", appointment);
    const expectedActions: Array<[string, boolean]> = [
      ["Edit", permissions.canEdit],
      ["Reschedule", permissions.canReschedule],
      ["Check in", permissions.canCheckIn],
      ["Mark no-show", permissions.canNoShow],
      ["Cancel", permissions.canCancel],
    ];
    for (const [label, allowed] of expectedActions) {
      const action = page.getByRole("button", { name: label, exact: true });
      if (allowed) await expect(action).toBeVisible();
      else await expect(action).toHaveCount(0);
    }
    await expect(page.getByRole("button", { name: "Start visit", exact: true })).toHaveCount(0);
    const staffActionsContained = await page.locator(".appointment-detail-actions").evaluate((actions) => {
      const actionRect = actions.getBoundingClientRect();
      const detailRect = actions.closest<HTMLElement>(".appointment-detail-page")!.getBoundingClientRect();
      return actionRect.left >= detailRect.left - 1 && actionRect.right <= detailRect.right + 1;
    });
    expect(staffActionsContained).toBe(true);
    await expectNoDocumentOverflow(page);
    expect(pageErrors).toEqual([]);
  });

  test("doctor appointment detail exposes only doctor-authorized actions", async ({ page }) => {
    test.setTimeout(60_000);
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await login(page, "doctor.one@pearlix-demo.local", "doctor");
    const appointment = await findAppointmentByStatus(page, "doctor");
    const detail = await loadedAppointmentDetail(page, "doctor", appointment);
    await expect(detail).toHaveAttribute("data-role", "DOCTOR");
    await expectAppointmentFacts(page);

    const permissions = getAppointmentPermissions("DOCTOR", appointment);
    const operationalActions: Array<[string, boolean]> = [
      ["Edit", permissions.canEdit],
      ["Reschedule", permissions.canReschedule],
      ["Check in", permissions.canCheckIn],
      ["Mark no-show", permissions.canNoShow],
      ["Cancel", permissions.canCancel],
    ];
    for (const [label, allowed] of operationalActions) {
      const action = page.getByRole("button", { name: label, exact: true });
      if (allowed) await expect(action).toBeVisible();
      else await expect(action).toHaveCount(0);
    }
    const startVisit = page.getByRole("button", { name: "Start visit", exact: true });
    if (permissions.canStartVisit) await expect(startVisit).toBeVisible();
    else await expect(startVisit).toHaveCount(0);
    await expectNoDocumentOverflow(page);
    expect(pageErrors).toEqual([]);
  });
});
