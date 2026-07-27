import { expect, test, type Page } from "@playwright/test";

const password = process.env.PEARLIX_E2E_PASSWORD;
const viewports = [
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
  { width: 1024, height: 768 },
] as const;

async function loginAsDoctor(page: Page) {
  if (!password) throw new Error("PEARLIX_E2E_PASSWORD must be set.");
  await page.goto("/login");
  await page.getByLabel("Email").fill("doctor.one@pearlix-demo.local");
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/doctor\/dashboard$/);
  const english = page.getByRole("button", { name: "EN", exact: true });
  if (await english.getAttribute("aria-pressed") !== "true") await english.click();
}

async function expectDeterministicWeekStatusLayout(page: Page) {
  const warnings = page.locator('.appointment-calendar-item[data-status="NEEDS_RESCHEDULE"]');
  const cancelled = page.locator('.appointment-calendar-item[data-status="CANCELLED"]');
  await expect.poll(() => warnings.count()).toBeGreaterThanOrEqual(2);
  await expect(cancelled).toHaveCount(1);
  await expect(warnings.first()).toContainText("Needs reschedule");
  await expect(warnings.nth(1)).toContainText("Needs reschedule");
  await expect(cancelled).toContainText("Cancelled");
  await expect(warnings.first()).toHaveClass(/status-warning/);
  await expect(warnings.nth(1)).toHaveClass(/status-warning/);
  await expect(cancelled).toHaveClass(/status-danger/);

  const geometry = await page.evaluate(() => {
    const warningCards = Array.from(document.querySelectorAll<HTMLElement>('.appointment-calendar-item[data-status="NEEDS_RESCHEDULE"]'));
    const cancelledCard = document.querySelector<HTMLElement>('.appointment-calendar-item[data-status="CANCELLED"]')!;
    const cards = [...warningCards, cancelledCard];
    const classNames = warningCards.map((card) => card.className);
    const warningStyles = warningCards.map((card) => getComputedStyle(card));
    const cancelledStyle = getComputedStyle(cancelledCard);
    const cardsInsideColumns = cards.every((card) => {
      const cardRect = card.getBoundingClientRect();
      const columnRect = card.closest(".appointment-calendar-column")!.getBoundingClientRect();
      const badge = card.querySelector<HTMLElement>(".v2-status")!;
      const badgeRect = badge.getBoundingClientRect();
      return cardRect.left >= columnRect.left - 1
        && cardRect.right <= columnRect.right + 1
        && badgeRect.left >= cardRect.left - 1
        && badgeRect.right <= cardRect.right + 1
        && badgeRect.bottom <= cardRect.bottom + 1
        && badge.scrollWidth <= badge.clientWidth + 1
        && badge.scrollHeight <= badge.clientHeight + 1;
    });
    const summary = document.querySelector<HTMLElement>(".appointments-summary-rail")!;
    const summaryPanel = summary.querySelector<HTMLElement>(".v2-card")!;
    const summaryRect = summary.getBoundingClientRect();
    const panelRect = summaryPanel.getBoundingClientRect();
    return {
      equalWarningClasses: classNames.every((className) => className === classNames[0]),
      equalWarningAccent: warningStyles.every((style) => style.borderInlineStartColor === warningStyles[0].borderInlineStartColor),
      warningAndDangerDiffer: warningStyles[0].borderInlineStartColor !== cancelledStyle.borderInlineStartColor,
      cardsInsideColumns,
      summaryInsidePanel: panelRect.left >= summaryRect.left - 1 && panelRect.right <= summaryRect.right + 1,
      noHorizontalOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    };
  });
  expect(geometry.equalWarningClasses).toBe(true);
  expect(geometry.equalWarningAccent).toBe(true);
  expect(geometry.warningAndDangerDiffer).toBe(true);
  expect(geometry.cardsInsideColumns).toBe(true);
  expect(geometry.summaryInsidePanel).toBe(true);
  expect(geometry.noHorizontalOverflow).toBe(true);
}

test("appointment colors follow status and Doctor One retains the seeded Active Visit", async ({ page }) => {
  test.setTimeout(90_000);
  await loginAsDoctor(page);

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/doctor/appointments/week?date=2026-07-27");
    await expect(page.getByRole("heading", { name: "Appointments", exact: true })).toBeVisible();
    await expectDeterministicWeekStatusLayout(page);
  }

  await page.goto("/doctor/visits/active");
  await expect(page.getByRole("heading", { name: "Lina Mansour" })).toBeVisible();
  await expect(page.getByRole("banner").getByText("Dr. Samir Nasser", { exact: true })).toBeVisible();
  await expect(page.getByRole("tab")).toHaveText(["Visit Notes", "X-rays & AI", "Billing"]);
  await expect(page.getByRole("button", { name: "Complete Visit" })).toBeVisible();
});
