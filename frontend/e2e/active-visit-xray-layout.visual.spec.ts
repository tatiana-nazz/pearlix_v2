import { expect, test, type Page } from "@playwright/test";

const password = process.env.PEARLIX_E2E_PASSWORD;
const viewports = [
  { width: 1440, height: 900, minimumViewerHeight: 480 },
  { width: 1280, height: 720, minimumViewerHeight: 315 },
  { width: 1024, height: 768, minimumViewerHeight: 350 },
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

async function expectLargeXrayWorkspace(page: Page, minimumViewerHeight: number) {
  const row = page.locator(".active-xray-main-row");
  const viewer = page.locator(".active-xray-canvas-panel");
  const aiResult = page.locator(".active-xray-ai-result");
  const original = viewer.locator(".protected-xray-original");
  const overlaySwitch = page.getByRole("switch", { name: "AI Overlay: Off" });

  await expect(row).toBeVisible();
  await expect(original).toBeVisible();
  await expect(aiResult.getByText("AI Result")).toBeVisible();
  await expect(overlaySwitch).toBeVisible();
  await expect(overlaySwitch).toBeEnabled();
  for (const control of ["Zoom In", "Zoom Out", "Reset", "Fit to View", "Fullscreen"]) {
    await expect(viewer.getByRole("button", { name: control })).toBeVisible();
  }

  const geometry = await page.evaluate(() => {
    const rect = (selector: string) => document.querySelector(selector)!.getBoundingClientRect();
    const rowRect = rect(".active-xray-main-row");
    const viewerRect = rect(".active-xray-canvas-panel");
    const aiRect = rect(".active-xray-ai-result");
    const canvasRect = rect(".protected-xray-canvas");
    const imageRect = rect(".protected-xray-original");
    const toolbarRect = rect(".protected-xray-toolbar");
    const historyRect = rect(".active-xray-history-panel");
    const detailsRect = rect(".active-xray-analysis-details");
    return {
      rowHeight: rowRect.height,
      viewerShare: viewerRect.width / (viewerRect.width + aiRect.width),
      sideBySide: viewerRect.right <= aiRect.left + 1 && Math.abs(viewerRect.top - aiRect.top) <= 1,
      imageContained: imageRect.left >= canvasRect.left - 1 && imageRect.right <= canvasRect.right + 1 && imageRect.top >= canvasRect.top - 1 && imageRect.bottom <= canvasRect.bottom + 1,
      imageBounds: { left: imageRect.left, right: imageRect.right, top: imageRect.top, bottom: imageRect.bottom },
      canvasBounds: { left: canvasRect.left, right: canvasRect.right, top: canvasRect.top, bottom: canvasRect.bottom },
      imageAspectRatio: (document.querySelector<HTMLImageElement>(".protected-xray-original")!.naturalWidth || 16) / (document.querySelector<HTMLImageElement>(".protected-xray-original")!.naturalHeight || 9),
      toolbarBelowViewer: toolbarRect.top >= canvasRect.bottom - 1,
      belowViewport: Math.max(0, rowRect.bottom - innerHeight),
      historyBelow: historyRect.top >= rowRect.bottom - 1,
      detailsBelowHistory: detailsRect.top >= historyRect.bottom - 1,
      noHorizontalOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    };
  });
  expect(geometry.rowHeight).toBeGreaterThanOrEqual(minimumViewerHeight);
  expect(geometry.viewerShare).toBeGreaterThanOrEqual(.68);
  expect(geometry.viewerShare).toBeLessThanOrEqual(.75);
  expect(geometry.sideBySide).toBe(true);
  expect(geometry.imageContained, JSON.stringify({ image: geometry.imageBounds, canvas: geometry.canvasBounds })).toBe(true);
  expect(geometry.imageAspectRatio).toBeCloseTo(16 / 9, 1);
  expect(geometry.toolbarBelowViewer).toBe(true);
  expect(geometry.belowViewport).toBeLessThanOrEqual(140);
  expect(geometry.historyBelow).toBe(true);
  expect(geometry.detailsBelowHistory).toBe(true);
  expect(geometry.noHorizontalOverflow).toBe(true);

  await expect(aiResult.getByText("Model Version")).toHaveCount(0);
  await expect(page.locator(".active-xray-analysis-details").getByText("Model Version")).toBeVisible();
  await expect(page.locator(".active-xray-analysis-details").getByText("Research-only AI analysis")).toBeVisible();
  await expect(viewer.locator(".protected-xray-overlay")).toHaveCount(0);
  await overlaySwitch.click();
  const overlay = viewer.locator(".protected-xray-overlay");
  await expect(page.getByRole("switch", { name: "AI Overlay: On" })).toBeVisible();
  await expect(overlay).toBeVisible();
  await expect(original).toBeVisible();
  const layers = await viewer.locator(".protected-xray-original, .protected-xray-overlay").evaluateAll((images) => images.map((image) => {
    const bounds = image.getBoundingClientRect();
    return { left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height };
  }));
  expect(layers).toHaveLength(2);
  expect(layers[1]).toEqual(layers[0]);
  await page.getByRole("switch", { name: "AI Overlay: On" }).click();
  await expect(viewer.locator(".protected-xray-overlay")).toHaveCount(0);
}

test("Doctor Active Visit keeps a large fitted X-ray beside concise AI results", async ({ page }) => {
  test.setTimeout(90_000);
  await loginAsDoctor(page);

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/doctor/visits/active");
    await expect(page.getByRole("heading", { name: "Lina Mansour" })).toBeVisible();
    await page.getByRole("tab", { name: "X-rays & AI" }).click();
    await expectLargeXrayWorkspace(page, viewport.minimumViewerHeight);
  }
});
