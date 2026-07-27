import { expect, test, type Page } from "@playwright/test";

const password = process.env.PEARLIX_E2E_PASSWORD;
const accounts = { staff: "staff.one@pearlix-demo.local", doctor: "doctor.one@pearlix-demo.local" } as const;
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

async function expectActionBarInFlow(page: Page, contentSelector: string) {
  const footer = page.locator(".active-visit-action-bar");
  const content = page.locator(contentSelector);
  await expect(content).toBeVisible();
  await expect(footer).toBeAttached();
  const geometry = await content.evaluate((contentElement) => {
    const contentRect = contentElement.getBoundingClientRect();
    const footerElement = document.querySelector<HTMLElement>(".active-visit-action-bar")!;
    const footerRect = footerElement.getBoundingClientRect();
    return {
      followsContent: Boolean(contentElement.compareDocumentPosition(footerElement) & Node.DOCUMENT_POSITION_FOLLOWING),
      contentClear: contentRect.bottom <= footerRect.top + 1,
      position: getComputedStyle(footerElement).position,
    };
  });
  expect(geometry.followsContent).toBe(true);
  expect(geometry.contentClear).toBe(true);
  expect(geometry.position).toBe("static");
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect.poll(() => page.evaluate(() => Math.ceil(window.scrollY + window.innerHeight) >= document.documentElement.scrollHeight - 1)).toBe(true);
  await expect(footer).toBeVisible();
  await expect(page.getByRole("button", { name: "Save Notes" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Complete Visit" })).toBeVisible();
  await expectNoDocumentOverflow(page);
}

async function expectActiveVisitFullWidth(page: Page) {
  const geometry = await page.evaluate(() => {
    const content = document.querySelector(".workspace-content")!;
    const pageElement = document.querySelector(".active-visit-page")!;
    const workspace = document.querySelector(".visit-workspace")!;
    const contentStyle = getComputedStyle(content);
    const availableWidth = content.getBoundingClientRect().width - parseFloat(contentStyle.paddingLeft) - parseFloat(contentStyle.paddingRight);
    return {
      pageDelta: Math.abs(pageElement.getBoundingClientRect().width - availableWidth),
      workspaceDelta: Math.abs(workspace.getBoundingClientRect().width - availableWidth),
    };
  });
  expect(geometry.pageDelta).toBeLessThanOrEqual(2);
  expect(geometry.workspaceDelta).toBeLessThanOrEqual(2);
}

async function expectPatientRailPinned(page: Page, profilePath: string) {
  await page.goto(profilePath);
  await expect(page.locator(".patient-identity-rail")).toBeVisible();
  const initial = await page.evaluate(() => {
    const rail = document.querySelector(".patient-identity-rail")!;
    const main = document.querySelector(".patient-detail-main")!;
    const railRect = rail.getBoundingClientRect();
    const mainRect = main.getBoundingClientRect();
    const style = getComputedStyle(rail);
    return { railTop: railRect.top, railBottom: railRect.bottom, mainTop: mainRect.top, noOverlap: railRect.right <= mainRect.left + 1, position: style.position, top: parseFloat(style.top), background: style.backgroundColor, zIndex: Number(style.zIndex), viewportHeight: innerHeight };
  });
  expect(initial.position).toBe("sticky");
  expect(initial.noOverlap).toBe(true);
  expect(initial.railBottom).toBeLessThanOrEqual(initial.viewportHeight + 1);
  expect(initial.background).not.toBe("rgba(0, 0, 0, 0)");
  expect(initial.zIndex).toBeGreaterThan(1);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const scrolled = await page.evaluate(() => {
    const railRect = document.querySelector(".patient-identity-rail")!.getBoundingClientRect();
    const mainRect = document.querySelector(".patient-detail-main")!.getBoundingClientRect();
    return { scrollY, railTop: railRect.top, railBottom: railRect.bottom, mainTop: mainRect.top, viewportHeight: innerHeight };
  });
  expect(scrolled.scrollY).toBeGreaterThan(0);
  expect(scrolled.railTop).toBeCloseTo(initial.top, 0);
  expect(scrolled.railBottom).toBeLessThanOrEqual(scrolled.viewportHeight + 1);
  expect(scrolled.mainTop).toBeLessThan(initial.mainTop);
  await expectNoDocumentOverflow(page);
}

async function expectXrayAndAiFit(page: Page, viewport: { width: number; height: number }) {
  const mainRow = page.locator(".active-xray-main-row");
  const viewer = page.locator(".active-xray-canvas-panel");
  const protectedViewer = viewer.locator(".protected-xray-viewer");
  const aiPanel = page.locator(".active-xray-ai-result");
  await expect(viewer.locator(".protected-xray-original")).toBeVisible();
  await expect(page.getByRole("switch", { name: /AI Overlay/ })).toBeVisible();
  await expect(aiPanel.getByText("AI Result")).toBeVisible();
  await expect(aiPanel.getByText("Status:")).toBeVisible();
  await expect(aiPanel.getByText("Overall Confidence")).toBeVisible();
  await expect(aiPanel.getByText("Findings")).toBeVisible();
  await expect(aiPanel.getByText("Model Version")).toHaveCount(0);
  await expect(aiPanel.getByText("Research-only AI analysis")).toHaveCount(0);
  const details = page.locator(".active-xray-analysis-details");
  const history = page.locator(".active-xray-history-panel");
  await expect(details.getByText("Model Version")).toBeVisible();
  await expect(details.getByText("Research-only AI analysis")).toBeVisible();
  const geometry = await page.evaluate(() => {
    const rect = (selector: string) => document.querySelector(selector)!.getBoundingClientRect();
    const row = rect(".active-xray-main-row");
    const viewerRect = rect(".active-xray-canvas-panel");
    const ai = rect(".active-xray-ai-result");
    const historyRect = rect(".active-xray-history-panel");
    const detailsRect = rect(".active-xray-analysis-details");
    const aiCard = document.querySelector<HTMLElement>(".active-xray-ai-result > .card")!;
    const aiCardStyle = getComputedStyle(aiCard);
    const findingsRect = rect(".xray-findings");
    return {
      sideBySide: viewerRect.right <= ai.left + 1 && Math.abs(viewerRect.top - ai.top) <= 1,
      stacked: viewerRect.bottom <= ai.top + 1 && Math.abs(viewerRect.left - ai.left) <= 1,
      viewerDominates: viewerRect.width / ai.width,
      rowHeight: row.height,
      viewerHeight: viewerRect.height,
      aiHasNoInternalScroll: !["auto", "scroll"].includes(aiCardStyle.overflowX) && !["auto", "scroll"].includes(aiCardStyle.overflowY) && aiCard.scrollWidth <= aiCard.clientWidth + 1 && aiCard.scrollHeight <= aiCard.clientHeight + 1,
      findingsVisible: findingsRect.bottom <= aiCard.getBoundingClientRect().bottom + 1,
      historyAfterRow: historyRect.top >= row.bottom - 1,
      detailsAfterHistory: detailsRect.top >= historyRect.bottom - 1,
    };
  });
  if (viewport.width > 1024) {
    expect(geometry.sideBySide).toBe(true);
    expect(geometry.viewerDominates).toBeGreaterThanOrEqual(2.2);
    expect(geometry.rowHeight).toBeGreaterThanOrEqual(viewport.height * .57);
  } else {
    expect(geometry.stacked).toBe(true);
    expect(geometry.viewerHeight).toBeGreaterThanOrEqual(430);
  }
  expect(geometry.aiHasNoInternalScroll).toBe(true);
  expect(geometry.findingsVisible).toBe(true);
  expect(geometry.historyAfterRow).toBe(true);
  expect(geometry.detailsAfterHistory).toBe(true);

  await viewer.getByRole("button", { name: "Fullscreen" }).click();
  const fullscreenControl = viewer.locator(".protected-xray-fullscreen-overlay-control");
  const fullscreenSwitch = fullscreenControl.getByRole("switch", { name: "AI Overlay: Off" });
  await expect(fullscreenSwitch).toBeVisible();
  await fullscreenSwitch.click();
  await expect(fullscreenControl.getByRole("switch", { name: "AI Overlay: On" })).toBeVisible();
  await expect(viewer.locator(".protected-xray-original")).toBeVisible();
  await expect(viewer.locator(".protected-xray-overlay")).toBeVisible();
  expect(await protectedViewer.evaluate((element) => element.matches(":fullscreen") || element.classList.contains("is-enlarged"))).toBe(true);
  const layerGeometry = await viewer.locator(".protected-xray-original, .protected-xray-overlay").evaluateAll((images) => images.map((image) => {
    const bounds = image.getBoundingClientRect();
    return { left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height };
  }));
  expect(layerGeometry).toHaveLength(2);
  expect(layerGeometry[1]).toEqual(layerGeometry[0]);
  await viewer.getByRole("button", { name: "Exit Fullscreen" }).click();
  await expect(page.getByRole("switch", { name: "AI Overlay: On" })).toBeVisible();
  await page.getByRole("switch", { name: "AI Overlay: On" }).click();
  await expect(viewer.locator(".protected-xray-overlay")).toHaveCount(0);
  await expect(mainRow).toBeVisible();
  await expect(history).toBeVisible();
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
    await expectActiveVisitFullWidth(page);
    const profilePath = await page.getByRole("link", { name: /Open .* patient profile/ }).getAttribute("href");
    expect(profilePath).toBeTruthy();
    await expectPatientRailPinned(page, profilePath!);
    await page.goto("/doctor/visits/active");
    await expectActionBarInFlow(page, ".visit-tab-panel");
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.getByRole("tab", { name: "X-rays & AI" }).click();
    await expectXrayAndAiFit(page, viewport);
    await expectActionBarInFlow(page, ".visit-tab-panel");
    await page.getByRole("tab", { name: "Billing" }).click();
    await expect(page.getByText("Billing details will be sent to Staff when the visit is completed.")).toBeVisible();
    await expect(page.getByLabel("Treatment / invoice description")).toBeEditable();
    await expect(page.getByLabel("Total treatment charge")).toBeEditable();
    await expect(page.getByLabel("Billing note")).toBeEditable();
    await fillBilling(page);
    await expectActionBarInFlow(page, ".visit-tab-panel");
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
