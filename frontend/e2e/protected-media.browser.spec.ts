import { expect, test, type Page } from "@playwright/test";

const password = process.env.PEARLIX_E2E_PASSWORD;

async function login(page: Page) {
  if (!password) throw new Error("PEARLIX_E2E_PASSWORD must be set for the local demo account.");
  await page.goto("/");
  await page.getByLabel("Email").fill("doctor.one@pearlix-demo.local");
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/doctor\/dashboard$/);
}

test("authenticated protected original and overlay render with temporary object URLs", async ({ page }) => {
  const mediaResponses: Array<{ status: number; type: string | undefined; url: string }> = [];
  const mediaFailures: string[] = [];
  page.on("response", (response) => {
    if (response.url().includes("/api/xrays/") && response.url().includes("/file/")) mediaResponses.push({ status: response.status(), type: response.headers()["content-type"], url: response.url() });
  });
  page.on("requestfailed", (request) => {
    if (request.url().includes("/api/xrays/") && request.url().includes("/file/")) mediaFailures.push(request.failure()?.errorText ?? "unknown");
  });
  await page.addInitScript(() => {
    const originalCreate = URL.createObjectURL.bind(URL);
    const originalRevoke = URL.revokeObjectURL.bind(URL);
    const mediaUrls = { created: [] as string[], revoked: [] as string[] };
    Object.defineProperty(window, "__pearlixProtectedMediaUrls", { value: mediaUrls });
    URL.createObjectURL = (blob: Blob) => {
      const url = originalCreate(blob);
      mediaUrls.created.push(url);
      return url;
    };
    URL.revokeObjectURL = (url: string) => {
      mediaUrls.revoked.push(url);
      return originalRevoke(url);
    };
  });
  await login(page);
  await page.goto("/doctor/xrays");
  await page.getByRole("row", { name: /synthetic demo x-ray with mock ai/i }).click();

  await expect.poll(() => mediaResponses.length + mediaFailures.length).toBeGreaterThan(0);
  expect(mediaFailures).toEqual([]);
  expect(mediaResponses).toContainEqual(expect.objectContaining({ status: 200, type: "image/png" }));
  await expect(page.locator('img[alt="Protected dental X-ray for clinical review"]')).toHaveCount(1);
  const original = page.locator('img[alt="Protected dental X-ray for clinical review"]');
  await expect.poll(() => original.evaluate((image) => image.naturalWidth)).toBeGreaterThan(0);
  await expect.poll(() => original.evaluate((image) => image.naturalHeight)).toBeGreaterThan(0);
  await expect(original).toHaveAttribute("src", /^blob:/);

  const overlayToggle = page.getByRole("button", { name: "Show overlay" });
  await expect(overlayToggle).toHaveAttribute("aria-pressed", "false");
  await overlayToggle.click();
  await expect(page.getByRole("button", { name: "Hide overlay" })).toHaveAttribute("aria-pressed", "true");
  const overlay = page.locator('img[alt="Protected AI overlay aligned to this X-ray"]');
  await expect(overlay).toHaveCount(1);
  await expect.poll(() => overlay.evaluate((image) => image.naturalWidth)).toBeGreaterThan(0);
  await expect.poll(() => overlay.evaluate((image) => image.naturalHeight)).toBeGreaterThan(0);
  await expect(overlay).toHaveAttribute("src", /^blob:/);

  await expect.poll(() => page.evaluate(() => window.__pearlixProtectedMediaUrls.created.length)).toBeGreaterThanOrEqual(2);
  await page.getByRole("link", { name: "X-rays & AI" }).click();
  await expect(page).toHaveURL(/\/doctor\/xrays$/);
  await expect.poll(() => page.evaluate(() => window.__pearlixProtectedMediaUrls.revoked.length)).toBeGreaterThanOrEqual(2);
});

test("protected-media request failures remain explicit and do not render an image", async ({ page }) => {
  await page.route("**/api/xrays/*/file/", (route) => route.abort("failed"));
  await login(page);
  await page.goto("/doctor/xrays");
  await page.getByRole("row", { name: /synthetic demo x-ray with mock ai/i }).click();
  await expect(page.getByRole("alert")).toContainText("The protected image is unavailable.");
  await expect(page.locator('img[alt="Protected dental X-ray for clinical review"]')).toHaveCount(0);
});

declare global {
  interface Window {
    __pearlixProtectedMediaUrls: { created: string[]; revoked: string[] };
  }
}
