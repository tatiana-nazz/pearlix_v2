import { expect, test } from "@playwright/test";


test("shared modal contains backward focus and returns it to the opener", async ({ page }) => {
  const email = process.env.PEARLIX_E2E_ADMIN_EMAIL;
  const password = process.env.PEARLIX_E2E_PASSWORD;
  if (!email || !password) throw new Error("Phase 6 local browser credentials must be supplied.");

  const consoleErrors: string[] = [];
  const failedResponses: string[] = [];
  const externalRequests: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("response", (response) => {
    if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`);
  });
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (["127.0.0.1", "localhost"].includes(url.hostname) || ["data:", "blob:"].includes(url.protocol)) {
      await route.continue();
      return;
    }
    externalRequests.push(url.href);
    await route.abort();
  });

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);

  const usersResponse = page.waitForResponse((response) => (
    new URL(response.url()).pathname === "/api/users/"
    && response.request().method() === "GET"
    && response.ok()
  ));
  await page.goto("/admin/users");
  const users = await (await usersResponse).json() as {
    results: Array<{ id: number; email: string; role: string }>;
  };
  const target = users.results.find((user) => user.email !== email && user.role !== "ADMIN");
  expect(target, "the disposable demo must include a non-Admin account").toBeTruthy();
  await page.goto(`/admin/users/${target!.id}`);

  const opener = page.getByRole("button", { name: "Reset temporary password" });
  await expect(opener).toBeVisible();
  await opener.click();
  const dialog = page.getByRole("dialog", { name: "Reset temporary password" });
  const box = await dialog.boundingBox();
  expect(box?.width).toBeGreaterThan(0);
  expect(box?.height).toBeGreaterThan(0);
  const close = dialog.getByRole("button", { name: "Close" });
  const cancel = dialog.getByRole("button", { name: "Cancel" });
  await expect(close).toBeFocused();
  expect(await page.evaluate(() => Array.from(document.body.children)
    .filter((element) => !element.classList.contains("v2-overlay-backdrop"))
    .every((element) => (element as HTMLElement).inert))).toBe(true);

  await page.keyboard.press("Shift+Tab");
  await expect(cancel).toBeFocused();
  expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe("BODY");
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();

  await dialog.evaluate((element) => (element as HTMLElement).focus());
  await expect(dialog).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(cancel).toBeFocused();
  expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe("BODY");

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
  expect(await page.evaluate(() => Array.from(document.body.children)
    .every((element) => !(element as HTMLElement).inert))).toBe(true);
  expect(consoleErrors).toEqual([]);
  expect(failedResponses).toEqual([]);
  expect(externalRequests).toEqual([]);
});
