import { expect, test, type Page } from "@playwright/test";

const password = process.env.PEARLIX_E2E_PASSWORD;
const viewports = [
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
  { width: 1024, height: 768 },
] as const;

async function login(page: Page, email: string) {
  if (!password) throw new Error("PEARLIX_E2E_PASSWORD must be set.");
  await page.goto("/login");
  await expect(page.locator("[data-brand-mark='pearlix-tooth']")).toBeVisible();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/(doctor|staff)\/dashboard$/);
  if (await page.locator("html").getAttribute("lang") !== "en") {
    await page.getByRole("button", { name: "Switch to English" }).click();
  }
}

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
}

async function authorizedJson<T>(page: Page, path: string): Promise<T> {
  return page.evaluate(async (apiPath) => {
    const persisted = JSON.parse(localStorage.getItem("pearlix-auth") ?? "{}");
    const response = await fetch(`http://127.0.0.1:8000/api${apiPath}`, { headers: { Authorization: `Bearer ${persisted?.state?.accessToken}` } });
    if (!response.ok) throw new Error(`Required API request failed: ${response.status}`);
    return response.json();
  }, path);
}

async function verifyVisitLayout(page: Page, viewport: (typeof viewports)[number]) {
  await page.setViewportSize(viewport);
  await page.goto("/doctor/visits/active");
  await expect(page.getByRole("heading", { name: "Lina Mansour" })).toBeVisible();
  await expect(page.getByRole("tab")).toHaveText(["Visit Notes", "X-rays & AI", "Billing"]);
  await expect(page.getByText("Medical Conditions History")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Open Full Patient Profile/i })).toHaveCount(0);

  const footer = page.locator(".active-visit-action-bar");
  await expect(footer).toBeAttached();
  expect(await footer.evaluate((element) => getComputedStyle(element).position)).toBe("static");

  const profilePath = await page.getByRole("link", { name: "Open patient profile" }).getAttribute("href");
  expect(profilePath).toBeTruthy();
  await page.goto(profilePath!);
  const rail = page.locator(".patient-identity-rail");
  await expect(rail).toBeVisible();
  const railGeometry = await rail.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return { position: style.position, bottom: rect.bottom, background: style.backgroundColor, zIndex: Number(style.zIndex) };
  });
  expect(railGeometry.position).toBe("sticky");
  expect(railGeometry.bottom).toBeLessThanOrEqual(viewport.height + 1);
  expect(railGeometry.background).not.toBe("rgba(0, 0, 0, 0)");
  expect(railGeometry.zIndex).toBeGreaterThan(1);

  await page.goto("/doctor/visits/active");
  await page.getByRole("tab", { name: "X-rays & AI" }).click();
  const viewer = page.locator(".active-xray-canvas-panel");
  const ai = page.locator(".active-xray-ai-result");
  await expect(viewer.locator(".protected-xray-original")).toBeVisible();
  await expect(page.getByRole("switch", { name: "AI overlay: Off" })).toBeVisible();
  await expect(ai.getByText("AI Result")).toBeVisible();
  const geometry = await page.evaluate(() => {
    const viewerRect = document.querySelector(".active-xray-canvas-panel")!.getBoundingClientRect();
    const aiElement = document.querySelector<HTMLElement>(".active-xray-ai-result")!;
    const aiRect = aiElement.getBoundingClientRect();
    const card = aiElement.querySelector<HTMLElement>(".card")!;
    const style = getComputedStyle(card);
    return {
      sideBySide: viewerRect.right <= aiRect.left + 1,
      stacked: viewerRect.bottom <= aiRect.top + 1,
      noInternalScroll: !["auto", "scroll"].includes(style.overflowY),
      historyAfter: document.querySelector(".active-xray-history-panel")!.getBoundingClientRect().top >= Math.max(viewerRect.bottom, aiRect.bottom) - 1,
    };
  });
  expect(viewport.width > 1024 ? geometry.sideBySide : geometry.stacked).toBe(true);
  expect(geometry.noInternalScroll).toBe(true);
  expect(geometry.historyAfter).toBe(true);

  await page.getByRole("switch", { name: "AI overlay: Off" }).click();
  await expect(viewer.locator(".protected-xray-overlay")).toBeVisible();
  await viewer.getByRole("button", { name: "Fullscreen" }).click();
  const fullscreenSwitch = viewer.locator(".protected-xray-fullscreen-overlay-control").getByRole("switch", { name: "AI overlay: On" });
  await expect(fullscreenSwitch).toBeVisible();
  await expect(viewer.getByRole("button", { name: "Zoom in" })).toBeVisible();
  await expect(viewer.getByRole("button", { name: "Reset" })).toBeVisible();
  await expect(viewer.getByRole("button", { name: "Fit to view" })).toBeVisible();
  await expect(viewer.locator(".protected-xray-scale")).toHaveText("100%");
  const layers = await viewer.locator(".protected-xray-original, .protected-xray-overlay").evaluateAll((images) => images.map((image) => {
    const rect = image.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  }));
  expect(layers).toHaveLength(2);
  expect(layers[1]).toEqual(layers[0]);
  await viewer.getByRole("button", { name: "Exit fullscreen" }).click();

  await page.getByRole("tab", { name: "Billing" }).click();
  await expect(page.getByLabel("Treatment / invoice description")).toBeEditable();
  await expect(page.getByLabel("Total treatment charge")).toBeEditable();
  await expect(page.getByLabel("Billing note")).toBeEditable();
  await noOverflow(page);
}

test("Active Visit layout, atomic billing, Staff handoff, patient rail, and status colors", async ({ page }) => {
  test.setTimeout(180_000);
  await login(page, "doctor.one@pearlix-demo.local");

  for (const viewport of viewports) await verifyVisitLayout(page, viewport);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/doctor/appointments/week");
  const semantic = await page.locator(".appointment-calendar-item").evaluateAll((cards) => cards.map((card) => {
    const badge = card.querySelector<HTMLElement>(".appointment-status-badge")!;
    return { status: badge.textContent?.trim().toUpperCase().replaceAll(" ", "_"), className: badge.className };
  }));
  for (const item of semantic) {
    const expected = item.status === "UPCOMING" ? "status-info" : item.status === "CHECKED_IN" ? "status-teal" : ["ACTIVE", "COMPLETED"].includes(item.status ?? "") ? "status-success" : item.status === "NEEDS_RESCHEDULE" ? "status-warning" : ["CANCELLED", "NO_SHOW"].includes(item.status ?? "") ? "status-danger" : null;
    if (expected) expect(item.className).toContain(expected);
  }

  await page.goto("/doctor/visits/active");
  await page.getByRole("tab", { name: "Billing" }).click();
  await page.getByLabel("Treatment / invoice description").fill("Restorative dental treatment");
  await page.getByLabel("Total treatment charge").fill("250.00");
  await page.getByLabel("Currency").selectOption("SYP");
  await page.getByLabel("Billing note").fill("Collect payment at reception after treatment.");
  await page.getByRole("tab", { name: "Visit Notes" }).click();
  await page.getByLabel("Objective Notes").fill("Synthetic active objective note. Atomic completion evidence.");
  await page.getByRole("tab", { name: "Billing" }).click();
  await expect(page.getByLabel("Treatment / invoice description")).toHaveValue("Restorative dental treatment");
  await page.getByRole("button", { name: "Complete Visit" }).click();
  const completion = page.waitForResponse((response) => response.url().endsWith("/complete/") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Complete Visit and Send to Billing" }).click();
  const response = await completion;
  expect(response.status()).toBe(200);
  const body = await response.json() as { visit: { status: string }; billing_handoff: { id: number; status: string; description: string } };
  expect(body.visit.status).toBe("COMPLETED");
  expect(body.billing_handoff).toMatchObject({ status: "PENDING", description: "Restorative dental treatment" });
  await expect(page.getByText("Visit completed and sent to Staff Billing.")).toBeVisible();
  await expect(page.getByRole("button", { name: /payment|paid/i })).toHaveCount(0);

  await page.evaluate(() => localStorage.clear());
  await login(page, "staff.one@pearlix-demo.local");
  const handoffs = await authorizedJson<{ results: Array<{ id: number; patient: { full_name: string }; description: string; status: string }> }>(page, "/billing-handoffs/?status=PENDING");
  expect(handoffs.results).toContainEqual(expect.objectContaining({ id: body.billing_handoff.id, patient: expect.objectContaining({ full_name: "Lina Mansour" }), description: "Restorative dental treatment", status: "PENDING" }));
  await page.goto("/staff/billing");
  await expect(page.getByRole("heading", { name: "Invoices & Payments" })).toBeVisible();
});
