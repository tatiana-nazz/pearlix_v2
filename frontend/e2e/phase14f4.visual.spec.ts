import { expect, test, type Page } from "@playwright/test";

const password = process.env.PEARLIX_E2E_PASSWORD;
const accounts = {
  admin: "admin@pearlix-demo.local",
  staff: "staff.one@pearlix-demo.local",
  doctor: "doctor.one@pearlix-demo.local",
} as const;
const viewports = [
  { width: 1920, height: 1080 },
  { width: 1536, height: 864 },
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
  { width: 1280, height: 720 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
] as const;

async function login(page: Page, email: string) {
  if (!password) throw new Error("PEARLIX_E2E_PASSWORD must be set.");
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/(admin|staff|doctor)\/dashboard$/);
  const english = page.getByRole("button", { name: "EN", exact: true });
  if (await english.getAttribute("aria-pressed") !== "true") await english.click();
}

async function authorizedJson<T>(page: Page, path: string): Promise<T> {
  return page.evaluate(async (apiPath) => {
    const persisted = JSON.parse(window.localStorage.getItem("pearlix-auth") ?? "{}");
    const accessToken = persisted?.state?.accessToken;
    const response = await fetch(`http://127.0.0.1:8000/api${apiPath}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!response.ok) throw new Error(`Required API request failed: ${response.status}`);
    return response.json();
  }, path);
}

async function activeVisitId(page: Page) {
  const payload = await authorizedJson<{ results: Array<{ id: number; status: string; patient: { full_name: string } }> }>(page, "/visits/?status=ACTIVE");
  const active = payload.results.find((visit) => visit.status === "ACTIVE" && visit.patient.full_name === "Lina Mansour");
  if (!active) throw new Error("The deterministic story must contain an active visit.");
  return active.id;
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
    const footerRect = document.querySelector(".active-visit-action-bar")!.getBoundingClientRect();
    const footerPosition = getComputedStyle(document.querySelector(".active-visit-action-bar")!).position;
    return {
      contentClear: contentRect.bottom <= footerRect.top + 1,
      finalContentClear: finalRect.bottom <= footerRect.top + 1,
      footerTreatmentCorrect: window.innerHeight <= 900 || window.innerWidth <= 1279 ? footerPosition === "static" : footerPosition === "sticky",
    };
  }, { content: contentSelector, finalContent: finalContentSelector });
  expect(geometry.contentClear).toBe(true);
  expect(geometry.finalContentClear).toBe(true);
  expect(geometry.footerTreatmentCorrect).toBe(true);
  await expect(page.getByRole("button", { name: "Save Notes" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Complete Visit" })).toBeVisible();
  await expectNoDocumentOverflow(page);
}

async function verifyStaticPatientRail(page: Page, role: "admin" | "staff") {
  await page.setViewportSize({ width: 1024, height: 768 });
  const patients = await authorizedJson<{ results: Array<{ id: number }> }>(page, "/patients/?search=Lina%20Mansour");
  const patientId = patients.results[0]?.id;
  if (!patientId) throw new Error("The deterministic active-visit patient is missing.");
  await page.goto(`/${role}/patients/${patientId}`);
  const rail = page.locator(".patient-identity-rail");
  const main = page.locator(".patient-detail-main");
  await expect(rail).toBeVisible();
  await expect(main).toBeVisible();
  expect(await rail.evaluate((element) => getComputedStyle(element).position)).toBe("sticky");
  expect(await page.locator(".workspace-content").evaluate((element) => getComputedStyle(element).overflow)).toBe("visible");
  const initialGeometry = await page.evaluate(() => ({
    railTop: Math.round(document.querySelector(".patient-identity-rail")!.getBoundingClientRect().top),
    mainTop: Math.round(document.querySelector(".patient-detail-main")!.getBoundingClientRect().top),
  }));
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const finalGeometry = await page.evaluate(() => ({
    railTop: Math.round(document.querySelector(".patient-identity-rail")!.getBoundingClientRect().top),
    mainTop: Math.round(document.querySelector(".patient-detail-main")!.getBoundingClientRect().top),
    scrollY: Math.round(window.scrollY),
    stickyTop: Math.round(Number.parseFloat(getComputedStyle(document.querySelector(".patient-identity-rail")!).top)),
  }));
  expect(finalGeometry.scrollY).toBeGreaterThan(0);
  expect(finalGeometry.mainTop).toBeLessThan(initialGeometry.mainTop);
  expect(Math.abs(finalGeometry.railTop - finalGeometry.stickyTop)).toBeLessThanOrEqual(1);
  expect(finalGeometry.railTop).toBeLessThan(initialGeometry.railTop);
  await expectNoDocumentOverflow(page);
  await page.setViewportSize({ width: 1023, height: 768 });
  expect(await rail.evaluate((element) => getComputedStyle(element).position)).toBe("static");
  await expectNoDocumentOverflow(page);
}

test("Staff sees semantic Month statuses, a static patient rail, and a read-only visit", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page, accounts.staff);
  await page.goto("/staff/appointments/month?date=2026-07-26");
  const items = page.locator(".appointment-month-item");
  await expect(items.first()).toBeVisible();
  const statusContract = await items.evaluateAll((nodes) => nodes.map((node) => ({
    status: node.getAttribute("data-status"),
    className: node.className,
    label: node.getAttribute("aria-label"),
  })));
  expect(statusContract.every((item) => item.label?.split(",").length === 3 && /status-(info|teal|ai|success|warning|danger)/.test(item.className))).toBe(true);
  await items.first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await verifyStaticPatientRail(page, "staff");

  await page.setViewportSize({ width: 1440, height: 900 });
  const visitId = await activeVisitId(page);
  await page.goto(`/staff/visits/${visitId}`);
  await expect(page.getByRole("tab")).toHaveText(["Visit Notes", "Patient Profile", "X-rays & AI", "Billing"]);
  await expect(page.getByLabel("Objective Notes")).toHaveCount(0);
  await page.getByRole("tab", { name: "X-rays & AI" }).click();
  await expect(page.locator(".protected-xray-original")).toBeVisible();
  await expect(page.getByRole("button", { name: "Upload X-ray" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Run AI Analysis" })).toHaveCount(0);
});

test("Admin retains protected read-only inspection without upload or AI mutation", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page, accounts.admin);
  await page.goto("/admin/appointments/month?date=2026-07-26");
  await expect(page.locator(".appointment-month-item").first()).toBeVisible();
  await verifyStaticPatientRail(page, "admin");

  await page.setViewportSize({ width: 1440, height: 900 });
  const visitId = await activeVisitId(page);
  await page.goto(`/admin/visits/${visitId}`);
  await expect(page.getByLabel("Objective Notes")).toHaveCount(0);
  await page.getByRole("tab", { name: "X-rays & AI" }).click();
  const original = page.locator(".protected-xray-original");
  await expect(original).toBeVisible();
  expect(await original.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  await expect(page.getByRole("button", { name: "Upload X-ray" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Run AI Analysis" })).toHaveCount(0);
});

test("Doctor completes the inline active-visit X-ray workflow at the frozen viewport matrix", async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page, accounts.doctor);
  await expect(page.getByRole("heading", { name: "Active visit", exact: true })).toBeVisible();
  await page.getByRole("link", { name: /Lina Mansour Open active visit/ }).click();
  await expect(page.getByRole("heading", { name: "Active Visit", exact: true })).toBeVisible();
  const themeToggle = page.locator(".theme-toggle");
  if ((await themeToggle.getAttribute("aria-label")) === "Theme: Light") await themeToggle.click();
  expect(await page.locator(".active-visit-context-stack").evaluate((element) => getComputedStyle(element).position)).toBe("static");
  expect(await page.locator(".active-visit-summary").evaluate((element) => getComputedStyle(element).boxShadow)).toBe("none");
  await expect(page.getByRole("tab")).toHaveText(["Visit Notes", "Patient Profile", "X-rays & AI", "Billing"]);
  await expect(page.locator(".active-visit-summary")).toBeVisible();
  await expect(page.locator(".active-visit-summary .active-visit-action-buttons")).toHaveCount(0);
  const notesLayout = await page.evaluate(() => {
    const summary = document.querySelector(".active-visit-summary")!.getBoundingClientRect();
    const workspace = document.querySelector(".visit-workspace")!.getBoundingClientRect();
    const subjective = document.querySelector(".clinical-note-subjective")!.getBoundingClientRect();
    const assessment = document.querySelector(".clinical-note-assessment")!.getBoundingClientRect();
    const general = document.querySelector(".clinical-note-general")!.getBoundingClientRect();
    const actionBar = document.querySelector(".active-visit-action-bar")!;
    const panel = document.querySelector(".visit-tab-panel")!;
    return {
      summaryWidthDelta: Math.abs(summary.width - workspace.width),
      twoColumns: assessment.left > subjective.left && Math.abs(assessment.top - subjective.top) < 2,
      generalSpansColumns: general.width > subjective.width * 1.8,
      actionsAfterContent: Boolean(panel.compareDocumentPosition(actionBar) & Node.DOCUMENT_POSITION_FOLLOWING),
    };
  });
  expect(notesLayout.summaryWidthDelta).toBeLessThan(2);
  expect(notesLayout.twoColumns).toBe(true);
  expect(notesLayout.generalSpansColumns).toBe(true);
  expect(notesLayout.actionsAfterContent).toBe(true);

  const notes = page.getByLabel("Objective Notes");
  const priorNotes = await notes.inputValue();
  await notes.fill(`${priorNotes} Browser acceptance.`);
  await page.getByRole("button", { name: "Save Notes" }).click();
  await expect(page.getByText("Saved just now")).toBeVisible();
  await page.getByRole("tab", { name: "Patient Profile" }).click();
  await expect(page.getByRole("heading", { name: "Patient Profile" })).toBeVisible();

  await page.getByRole("tab", { name: "X-rays & AI" }).click();
  await expect(page.getByRole("heading", { name: "Selected X-ray" })).toBeVisible();
  await expect(page.locator(".active-xray-canvas-panel")).toBeVisible();
  await expect(page.locator(".active-xray-list-panel")).toBeVisible();
  await expect(page.locator(".active-xray-review-main")).toBeVisible();
  await expect(page.getByRole("heading", { name: "AI Result", exact: true })).toBeVisible();
  const protectedOriginal = page.locator(".protected-xray-original");
  await expect(protectedOriginal).toBeVisible();
  await expect.poll(() => protectedOriginal.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  const reviewGeometry = await page.evaluate(() => {
    const canvas = document.querySelector(".active-xray-canvas-panel")!.getBoundingClientRect();
    const list = document.querySelector(".active-xray-list-panel")!.getBoundingClientRect();
    const main = document.querySelector(".active-xray-review-main")!.getBoundingClientRect();
    const ai = document.querySelector(".active-xray-ai-column")!.getBoundingClientRect();
    return {
      listIsLeft: list.right <= main.left + 2,
      alignedTop: Math.abs(list.top - main.top) < 1,
      canvasWiderThanAi: canvas.width > ai.width,
    };
  });
  expect(reviewGeometry.listIsLeft).toBe(true);
  expect(reviewGeometry.alignedTop).toBe(true);
  expect(reviewGeometry.canvasWiderThanAi).toBe(true);
  await page.getByRole("button", { name: "Active visit bitewing X-ray without AI" }).click();
  const runRequest = page.waitForResponse((response) => response.url().includes("/run-ai/") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Run AI Analysis" }).click();
  expect((await runRequest).ok()).toBe(true);
  await expect(page.getByText("Research-only AI analysis completed.")).toBeVisible();

  await page.getByRole("button", { name: "Upload X-ray" }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "phase14f4-disposable.png",
    mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"),
  });
  await page.getByRole("button", { name: "Upload", exact: true }).click();
  await expect(page.getByText("phase14f4-disposable.png").first()).toBeVisible();
  await expect(protectedOriginal).toBeVisible();

  await page.getByRole("button", { name: "Active visit panoramic X-ray with mock AI" }).click();
  const viewer = page.locator(".protected-xray-viewer");
  await expect(viewer).toBeVisible();
  await expect(protectedOriginal).toBeVisible();
  await expect.poll(() => protectedOriginal.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  await expect(page.getByRole("button", { name: "Show AI Overlay" })).toBeVisible();
  await page.getByRole("button", { name: "Zoom In" }).click();
  await expect(page.locator(".protected-xray-media")).toHaveAttribute("data-scale", "1.25");
  await page.getByRole("button", { name: "Zoom Out" }).click();
  await expect(page.locator(".protected-xray-media")).toHaveAttribute("data-scale", "1.00");
  await page.getByRole("button", { name: "Show AI Overlay" }).click();
  const protectedOverlay = page.locator(".protected-xray-overlay");
  await expect(protectedOverlay).toBeVisible();
  await expect.poll(() => protectedOverlay.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  const overlayGeometry = await page.evaluate(() => {
    const originalElement = document.querySelector(".protected-xray-original")!;
    const overlayElement = document.querySelector(".protected-xray-overlay")!;
    const original = originalElement.getBoundingClientRect();
    const overlay = overlayElement.getBoundingClientRect();
    return {
      deltas: [overlay.x - original.x, overlay.y - original.y, overlay.width - original.width, overlay.height - original.height],
      sameCanvas: originalElement.closest(".protected-xray-canvas") === overlayElement.closest(".protected-xray-canvas"),
      separateOverlayFigures: document.querySelectorAll(".protected-xray-overlay-figure, .xray-overlay-figure, .overlay-figure").length,
    };
  });
  expect(overlayGeometry.deltas.every((delta) => Math.abs(delta) < 1)).toBe(true);
  expect(overlayGeometry.sameCanvas).toBe(true);
  expect(overlayGeometry.separateOverlayFigures).toBe(0);
  await page.getByRole("button", { name: "Hide AI Overlay" }).click();
  await expect(page.locator(".protected-xray-overlay")).toHaveCount(0);
  await expect(protectedOriginal).toBeVisible();
  await page.getByRole("button", { name: "Fit to View" }).click();
  await page.getByRole("button", { name: "Reset" }).click();
  await page.getByRole("button", { name: "Fullscreen" }).click();
  await expect(page.getByRole("button", { name: "Exit Fullscreen" })).toBeVisible();
  await page.getByRole("button", { name: "Exit Fullscreen" }).click();

  await page.getByRole("tab", { name: "Billing" }).click();
  await expect(page.getByText(/Billing handoff/i).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /payment/i })).toHaveCount(0);

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/doctor/appointments/month?date=2026-07-26");
    await expect(page.locator(".appointment-month-item").first()).toBeVisible();
    await expectNoDocumentOverflow(page);
    await page.goto("/doctor/visits/active");
    await expectActionFooterClear(page, ".active-visit-notes-card", ".clinical-note-general");
    await page.getByRole("tab", { name: "X-rays & AI" }).click();
    await expect(viewer).toBeVisible();
    await expectActionFooterClear(page, ".active-xray-workspace", ".active-xray-ai-column");
  }
});
