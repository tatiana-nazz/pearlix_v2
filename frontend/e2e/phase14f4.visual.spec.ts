import { expect, test, type Page } from "@playwright/test";

const password = process.env.PEARLIX_E2E_PASSWORD;
const accounts = { staff: "staff.one@pearlix-demo.local", doctor: "doctor.one@pearlix-demo.local" } as const;
const viewports = [
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
] as const;

async function login(page: Page, email: string) {
  if (!password) throw new Error("PEARLIX_E2E_PASSWORD must be set.");
  await page.goto("/login");
  await expect(page.locator("[data-brand-mark='pearlix-tooth']")).toBeVisible();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/(staff|doctor)\/dashboard$/);
  const english = page.getByRole("button", { name: "EN", exact: true });
  if (await english.getAttribute("aria-pressed") !== "true") await english.click();
  await expect(page.locator(".app-sidebar-brand [data-brand-mark='pearlix-tooth']")).toBeVisible();
}

async function authorizedJson<T>(page: Page, path: string): Promise<T> {
  return page.evaluate(async (apiPath) => {
    const persisted = JSON.parse(window.localStorage.getItem("pearlix-auth") ?? "{}");
    const response = await fetch(`http://127.0.0.1:8000/api${apiPath}`, { headers: { Authorization: `Bearer ${persisted?.state?.accessToken}` } });
    if (!response.ok) throw new Error(`Required API request failed: ${response.status}`);
    return response.json();
  }, path);
}

async function expectNoDocumentOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
}

async function expectActionFooterClear(page: Page, contentSelector: string, finalContentSelector: string) {
  const footer = page.locator(".active-visit-action-bar");
  await expect(footer).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect.poll(() => page.evaluate(() => Math.ceil(window.scrollY + window.innerHeight) >= document.documentElement.scrollHeight - 1)).toBe(true);
  const geometry = await page.evaluate(({ content, finalContent }) => {
    const contentRect = document.querySelector(content)!.getBoundingClientRect();
    const finalRect = document.querySelector(finalContent)!.getBoundingClientRect();
    const footerElement = document.querySelector(".active-visit-action-bar")!;
    const footerRect = footerElement.getBoundingClientRect();
    return {
      contentClear: contentRect.bottom <= footerRect.top + 1,
      finalContentClear: finalRect.bottom <= footerRect.top + 1,
      position: getComputedStyle(footerElement).position,
    };
  }, { content: contentSelector, finalContent: finalContentSelector });
  expect(geometry.contentClear).toBe(true);
  expect(geometry.finalContentClear).toBe(true);
  expect(geometry.position).toBe("sticky");
  await expect(page.getByRole("button", { name: "Save Notes" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Complete Visit" })).toBeVisible();
  await expectNoDocumentOverflow(page);
}

async function fillBilling(page: Page) {
  await page.getByLabel("Treatment / invoice description").fill("Restorative dental treatment");
  await page.getByLabel("Total treatment charge").fill("250.00");
  await page.getByLabel("Currency").selectOption("SYP");
  await page.getByLabel("Billing note").fill("Collect payment at reception after treatment.");
}

test("Doctor completes one atomic visit-and-billing workflow and Staff receives the handoff", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page, accounts.doctor);
  await page.getByRole("button", { name: "Collapse sidebar" }).click();
  await expect(page.locator(".app-sidebar-brand [data-brand-mark='pearlix-tooth']")).toBeVisible();
  await page.getByRole("button", { name: "Expand sidebar" }).click();

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/doctor/visits/active");
    await expect(page.getByRole("tab")).toHaveText(["Visit Notes", "X-rays & AI", "Billing"]);
    await expectActionFooterClear(page, ".active-visit-notes-card", ".clinical-note-general");
    await page.getByRole("tab", { name: "X-rays & AI" }).click();
    await expect(page.locator(".protected-xray-original")).toBeVisible();
    await expectActionFooterClear(page, ".active-xray-workspace", ".active-xray-history-panel");
    await page.getByRole("tab", { name: "Billing" }).click();
    await expect(page.getByText("Billing details will be sent to Staff when the visit is completed.")).toBeVisible();
    await expect(page.getByLabel("Treatment / invoice description")).toBeEditable();
    await expect(page.getByLabel("Total treatment charge")).toBeEditable();
    await expect(page.getByLabel("Billing note")).toBeEditable();
    await fillBilling(page);
    await expectActionFooterClear(page, ".active-visit-billing-card", ".active-visit-billing-note");
    await page.getByRole("button", { name: "Complete Visit" }).click();
    const dialog = page.getByRole("dialog", { name: "Complete this visit?" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("250.00");
    await expect(dialog).toContainText("SYP");
    const dialogBox = await dialog.boundingBox();
    expect(dialogBox).not.toBeNull();
    expect(dialogBox!.x).toBeGreaterThanOrEqual(0);
    expect(dialogBox!.x + dialogBox!.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(dialogBox!.y + dialogBox!.height).toBeLessThanOrEqual(viewport.height + 1);
    await page.getByRole("button", { name: "Cancel" }).click();
    await expectNoDocumentOverflow(page);
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/doctor/visits/active");
  const objective = page.getByLabel("Objective Notes");
  await objective.fill(`${await objective.inputValue()} Atomic completion evidence.`);
  await page.getByRole("tab", { name: "Billing" }).click();
  await fillBilling(page);
  await page.getByRole("tab", { name: "Visit Notes" }).click();
  await page.getByRole("tab", { name: "Billing" }).click();
  await expect(page.getByLabel("Treatment / invoice description")).toHaveValue("Restorative dental treatment");
  await expect(page.getByLabel("Total treatment charge")).toHaveValue("250.00");
  await page.getByRole("button", { name: "Complete Visit" }).click();
  const completionResponse = page.waitForResponse((response) => response.url().includes("/visits/") && response.url().endsWith("/complete/") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Complete Visit and Send to Billing" }).click();
  const response = await completionResponse;
  expect(response.status()).toBe(200);
  const payload = await response.json() as { visit: { status: string; completed_at: string | null }; billing_handoff: { id: number; description: string; note: string; suggested_amount: string; currency: string; status: string } };
  expect(payload.visit.status).toBe("COMPLETED");
  expect(payload.visit.completed_at).toBeTruthy();
  expect(payload.billing_handoff).toMatchObject({ description: "Restorative dental treatment", note: "Collect payment at reception after treatment.", currency: "SYP", status: "PENDING" });
  expect(Number(payload.billing_handoff.suggested_amount)).toBe(250);
  await expect(page.getByText("Visit completed and sent to Staff Billing.")).toBeVisible();
  await expect(page.getByText("Sent to Staff Billing", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /payment|paid|invoice/i })).toHaveCount(0);

  await page.evaluate(() => window.localStorage.clear());
  await login(page, accounts.staff);
  await page.goto("/staff/billing/handoffs");
  const row = page.getByRole("row", { name: /Lina Mansour/ }).filter({ hasText: "Restorative dental treatment" });
  await expect(row).toBeVisible();
  await expect(row.getByRole("cell", { name: "Dr. Samir Nasser", exact: true })).toBeVisible();
  await expect(row).toContainText("Collect payment at reception after treatment.");
  const expectedAmount = new Intl.NumberFormat("en-US", { style: "currency", currency: "SYP", currencyDisplay: "code", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(250);
  await expect(row.getByRole("cell", { name: expectedAmount, exact: true })).toBeVisible();
  await expect(row).toContainText("PENDING");
  const handoffs = await authorizedJson<{ results: Array<{ id: number; visit: { id: number }; patient: { full_name: string }; doctor: { full_name: string }; description: string; note: string; suggested_amount: string; currency: string; status: string }> }>(page, "/billing-handoffs/?status=PENDING");
  const handoff = handoffs.results.find((candidate) => candidate.id === payload.billing_handoff.id);
  expect(handoff).toBeDefined();
  expect(handoff!.patient.full_name).toBe("Lina Mansour");
  expect(handoff!.doctor.full_name).toBe("Dr. Samir Nasser");
  expect(handoff!.visit.id).toBeTruthy();
  expect(handoff!.description).toBe("Restorative dental treatment");
  expect(Number(handoff!.suggested_amount)).toBe(250);
  expect(handoff!.currency).toBe("SYP");
  expect(handoff!.status).toBe("PENDING");
  expect(handoff!.note).toBe("Collect payment at reception after treatment.");
});
