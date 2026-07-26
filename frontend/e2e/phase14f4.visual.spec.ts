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

async function verifyStaticPatientRail(page: Page, role: "admin" | "staff") {
  const patients = await authorizedJson<{ results: Array<{ id: number }> }>(page, "/patients/?search=Lina%20Mansour");
  const patientId = patients.results[0]?.id;
  if (!patientId) throw new Error("The deterministic active-visit patient is missing.");
  await page.goto(`/${role}/patients/${patientId}`);
  const rail = page.locator(".patient-identity-rail");
  await expect(rail).toBeVisible();
  expect(await rail.evaluate((element) => getComputedStyle(element).position)).toBe("sticky");
  await page.getByRole("tab", { name: "Medical Summary" }).click();
  await page.evaluate(() => window.scrollTo(0, 260));
  const firstTop = await rail.evaluate((element) => Math.round(element.getBoundingClientRect().top));
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const secondTop = await rail.evaluate((element) => Math.round(element.getBoundingClientRect().top));
  expect(Math.abs(firstTop - secondTop)).toBeLessThanOrEqual(1);
  await expectNoDocumentOverflow(page);
  await page.setViewportSize({ width: 768, height: 1024 });
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
  await expect(page.getByRole("tab")).toHaveText(["Visit Notes", "Patient Profile", "X-rays / Attachments", "Billing / Invoice Handoff"]);
  await expect(page.getByLabel("Clinical notes")).toHaveCount(0);
  await page.getByRole("tab", { name: "X-rays / Attachments" }).click();
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
  await expect(page.getByLabel("Clinical notes")).toHaveCount(0);
  await page.getByRole("tab", { name: "X-rays / Attachments" }).click();
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
  await expect(page.getByRole("tab")).toHaveText(["Visit Notes", "Patient Profile", "X-rays / Attachments", "Billing / Invoice Handoff"]);

  const notes = page.getByLabel("Clinical notes");
  const priorNotes = await notes.inputValue();
  await notes.fill(`${priorNotes} Browser acceptance.`);
  await page.getByRole("button", { name: "Save Notes" }).last().click();
  await expect(page.getByText("Notes saved.")).toBeVisible();
  await page.getByRole("tab", { name: "Patient Profile" }).click();
  await expect(page.getByRole("heading", { name: "Patient Profile" })).toBeVisible();

  await page.getByRole("tab", { name: "X-rays / Attachments" }).click();
  await expect(page.getByRole("heading", { name: "Selected X-ray" })).toBeVisible();
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
  await expect(page.locator(".protected-xray-original")).toBeVisible();

  await page.getByRole("button", { name: "Active visit panoramic X-ray with mock AI" }).click();
  const viewer = page.locator(".protected-xray-viewer");
  await expect(viewer).toBeVisible();
  await expect(page.getByRole("button", { name: "Show AI Overlay" })).toBeVisible();
  await page.getByRole("button", { name: "Zoom In" }).click();
  await expect(page.locator(".protected-xray-media")).toHaveAttribute("data-scale", "1.25");
  await page.getByRole("button", { name: "Zoom Out" }).click();
  await expect(page.locator(".protected-xray-media")).toHaveAttribute("data-scale", "1.00");
  await page.getByRole("button", { name: "Show AI Overlay" }).click();
  await expect(page.locator(".protected-xray-overlay")).toBeVisible();
  const alignment = await page.evaluate(() => {
    const original = document.querySelector(".protected-xray-original")!.getBoundingClientRect();
    const overlay = document.querySelector(".protected-xray-overlay")!.getBoundingClientRect();
    return [overlay.x - original.x, overlay.y - original.y, overlay.width - original.width, overlay.height - original.height];
  });
  expect(alignment.every((delta) => Math.abs(delta) < 1)).toBe(true);
  await page.getByRole("button", { name: "Hide AI Overlay" }).click();
  await expect(page.locator(".protected-xray-overlay")).toHaveCount(0);
  await page.getByRole("button", { name: "Fit to View" }).click();
  await page.getByRole("button", { name: "Reset" }).click();
  await page.getByRole("button", { name: "Fullscreen" }).click();
  await expect(page.getByRole("button", { name: "Exit Fullscreen" })).toBeVisible();
  await page.getByRole("button", { name: "Exit Fullscreen" }).click();

  await page.getByRole("tab", { name: "Billing / Invoice Handoff" }).click();
  await expect(page.getByText(/Billing handoff/i).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /payment/i })).toHaveCount(0);

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/doctor/appointments/month?date=2026-07-26");
    await expect(page.locator(".appointment-month-item").first()).toBeVisible();
    await expectNoDocumentOverflow(page);
    await page.goto("/doctor/visits/active");
    await page.getByRole("tab", { name: "X-rays / Attachments" }).click();
    await expect(viewer).toBeVisible();
    await expectNoDocumentOverflow(page);
  }
});
