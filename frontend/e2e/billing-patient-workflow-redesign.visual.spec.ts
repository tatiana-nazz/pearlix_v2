import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const password = process.env.PEARLIX_E2E_PASSWORD;
const baseURL = process.env.PEARLIX_E2E_BASE_URL ?? "http://127.0.0.1:5173";
const accounts = {
  admin: "admin@pearlix-demo.local",
  staff: "staff.one@pearlix-demo.local",
  doctor: "doctor.one@pearlix-demo.local",
} as const;
type Role = keyof typeof accounts;

async function login(page: Page, role: Role) {
  if (!password) throw new Error("PEARLIX_E2E_PASSWORD must be set.");
  await page.goto("/login");
  await page.getByLabel("Email").fill(accounts[role]);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(new RegExp(`/${role}/dashboard$`));
  const english = page.getByRole("button", { name: "EN", exact: true });
  if (await english.getAttribute("aria-pressed") !== "true") await english.click();
  const theme = page.locator(".theme-toggle");
  if (await theme.getAttribute("aria-pressed") === "true") await theme.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
}

type InvoiceResult = {
  id: number;
  invoice_number: string;
  status: string;
  total_amount: string;
  remaining_amount: string;
  currency: string;
  patient: { id: number; full_name: string };
  visit?: { id: number } | null;
  appointment?: { id: number } | null;
};

async function invoiceBySearch(page: Page, role: "admin" | "staff", search: string) {
  const responsePromise = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname.endsWith("/api/invoices/") && url.searchParams.get("search") === search && response.request().method() === "GET" && response.ok();
  });
  await page.goto(`/${role}/billing/invoices?search=${encodeURIComponent(search)}`);
  const payload = await (await responsePromise).json() as { count: number; results: InvoiceResult[] };
  expect(payload.count).toBe(1);
  return payload.results[0]!;
}

async function openInvoiceCount(page: Page) {
  const card = page.locator('a.billing-kpi-card[href="/staff/billing/invoices"]');
  await expect(card).toBeVisible();
  return Number((await card.locator("strong").innerText()).replace(/[^0-9]/g, ""));
}

async function closeContext(context: BrowserContext) {
  await context.close();
}

async function expectNoOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  await expect(page.locator(".vite-error-overlay, #webpack-dev-server-client-overlay")).toHaveCount(0);
}

test.describe("billing and patient financial workflow redesign", () => {
  test("invoice navigation preserves invoice and patient destinations", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page, "staff");
    const invoice = await invoiceBySearch(page, "staff", "Comprehensive restorative treatment");
    await expect(page.locator(".billing-workspace-tabs a")).toHaveText(["Overview", "Invoices"]);
    await expect(page.getByRole("link", { name: "Handoffs" })).toHaveCount(0);
    await page.getByRole("row", { name: new RegExp(invoice.invoice_number) }).click();
    await expect(page).toHaveURL(`/staff/billing/invoices/${invoice.id}`);
    await expect(page.getByRole("heading", { name: invoice.invoice_number })).toBeVisible();
    await expect(page.getByRole("link", { name: "Open Patient" })).toHaveAttribute("href", `/staff/patients/${invoice.patient.id}?tab=billing`);
    await expect(page.getByRole("link", { name: `Visit #${invoice.visit!.id}` })).toHaveAttribute("href", `/staff/visits/${invoice.visit!.id}`);
    await expect(page.getByRole("link", { name: `Appointment #${invoice.appointment!.id}` })).toHaveAttribute("href", `/staff/appointments/${invoice.appointment!.id}`);
    await page.getByRole("link", { name: invoice.patient.full_name }).first().click();
    await expect(page).toHaveURL(`/staff/patients/${invoice.patient.id}?tab=billing`);
    await expect(page.getByRole("tab", { name: "Billing" })).toHaveAttribute("aria-selected", "true");
    await expectNoOverflow(page);
  });

  test("patient billing and edit modal keep identity and scrolling usable", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await login(page, "staff");
    const invoice = await invoiceBySearch(page, "staff", "Comprehensive restorative treatment");
    await page.goto(`/staff/patients/${invoice.patient.id}?tab=billing`);
    await expect(page.locator(".patient-identity-rail").getByText("Gender", { exact: true })).toBeVisible();
    await expect(page.locator(".patient-identity-rail").getByText("Age", { exact: true })).toBeVisible();
    await expect(page.getByText(invoice.invoice_number)).toBeVisible();
    await expect(page.getByRole("link", { name: "New invoice for patient" })).toHaveAttribute("href", `/staff/billing/invoices/new?patient_id=${invoice.patient.id}`);
    await page.getByRole("button", { name: "Edit" }).click();
    const dialog = page.getByRole("dialog", { name: "Edit Patient" });
    await expect(dialog).toBeVisible();
    const geometry = await dialog.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      const body = element.querySelector<HTMLElement>(".v2-overlay-body")!;
      return { contained: bounds.top >= 0 && bounds.bottom <= innerHeight, bodyScrollable: getComputedStyle(body).overflowY === "auto" };
    });
    expect(geometry).toEqual({ contained: true, bodyScrollable: true });
    await dialog.getByRole("button", { name: "Close" }).click();
    await expect(dialog).toHaveCount(0);
    await page.getByRole("button", { name: "AR", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator('[dir="ltr"]').first()).toBeVisible();
    await expectNoOverflow(page);
    await page.getByRole("button", { name: "EN", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  });

  test("Staff creates and edits a manual invoice with reactive workspace updates", async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 1280, height: 720 });
    await login(page, "staff");
    await page.goto("/staff/billing/invoices/new");
    await expectNoOverflow(page);
    await page.getByRole("combobox", { name: "Patient" }).fill("Lina");
    const option = page.getByRole("option").first();
    await expect(option).toBeVisible();
    await option.click();
    await page.getByLabel("Description").fill("Stage 6 manual verification treatment");
    await page.getByLabel("Total amount").fill("40.00");
    await page.getByLabel("Currency").selectOption("USD");
    const createResponse = page.waitForResponse((response) => new URL(response.url()).pathname.endsWith("/api/invoices/") && response.request().method() === "POST" && response.status() === 201);
    await page.getByRole("button", { name: "Create invoice" }).click();
    const created = await (await createResponse).json() as InvoiceResult;
    await expect(page).toHaveURL(`/staff/billing/invoices/${created.id}`);
    await expect(page.getByText("Stage 6 manual verification treatment").first()).toBeVisible();
    await page.getByRole("button", { name: "Edit invoice" }).click();
    const editDialog = page.getByRole("dialog", { name: "Edit invoice" });
    await editDialog.getByLabel("Description").fill("Stage 6 edited manual verification treatment");
    await editDialog.getByLabel("Notes").fill("Reactive edit verification");
    const editResponse = page.waitForResponse((response) => new URL(response.url()).pathname.endsWith(`/api/invoices/${created.id}/`) && response.request().method() === "PATCH" && response.ok());
    await editDialog.getByRole("button", { name: "Save invoice" }).click();
    await editResponse;
    await expect(page.getByText("Invoice updated.")).toBeVisible();
    await expect(page.getByText("Stage 6 edited manual verification treatment").first()).toBeVisible();

    await page.goto("/staff/billing/overview");
    await expect(page.getByText(created.invoice_number).first()).toBeVisible();
    await page.locator(".theme-toggle").click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expectNoOverflow(page);
    await page.locator(".theme-toggle").click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.goto(`/staff/billing/invoices?search=${encodeURIComponent(created.invoice_number)}`);
    await expect(page.getByText(created.invoice_number)).toBeVisible();
    await page.goto(`/staff/patients/${created.patient.id}?tab=billing`);
    await expect(page.getByText(created.invoice_number)).toBeVisible();
    await page.goto("/staff/dashboard");
    await expect(page.getByText(created.invoice_number)).toBeVisible();
  });

  test("Staff payment and cancellation update every financial surface", async ({ page }) => {
    test.setTimeout(75_000);
    await page.setViewportSize({ width: 1280, height: 720 });
    await login(page, "staff");
    await page.goto("/staff/billing/overview");
    const initialOpenCount = await openInvoiceCount(page);

    const invoice = await invoiceBySearch(page, "staff", "Orthodontic consultation");
    await page.goto(`/staff/billing/invoices/${invoice.id}`);
    await page.getByRole("button", { name: "Record payment" }).click();
    let paymentDialog = page.getByRole("dialog", { name: "Record payment" });
    await paymentDialog.getByRole("textbox", { name: "Amount" }).fill("100000.00");
    await paymentDialog.getByLabel("Notes (optional)").fill("Stage 6 partial payment");
    let paymentResponse = page.waitForResponse((response) => new URL(response.url()).pathname.endsWith(`/api/invoices/${invoice.id}/payments/`) && response.request().method() === "POST" && response.status() === 201);
    await paymentDialog.getByRole("button", { name: "Record payment" }).click();
    await paymentResponse;
    await expect(page.getByText("PARTIALLY PAID", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("region", { name: "Invoice financial summary" })).toContainText(/SYP\s*200,000/);
    await page.goto(`/staff/patients/${invoice.patient.id}?tab=billing`);
    await expect(page.getByRole("row", { name: new RegExp(invoice.invoice_number) })).toContainText("PARTIALLY PAID");

    await page.goto(`/staff/billing/invoices/${invoice.id}`);
    await page.getByRole("button", { name: "Record payment" }).click();
    paymentDialog = page.getByRole("dialog", { name: "Record payment" });
    await paymentDialog.getByRole("button", { name: "Pay remaining balance" }).click();
    await expect(paymentDialog.getByRole("textbox", { name: "Amount" })).toHaveValue("200000.00");
    paymentResponse = page.waitForResponse((response) => new URL(response.url()).pathname.endsWith(`/api/invoices/${invoice.id}/payments/`) && response.request().method() === "POST" && response.status() === 201);
    await paymentDialog.getByRole("button", { name: "Record payment" }).click();
    await paymentResponse;
    await expect(page.getByText("PAID", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("region", { name: "Invoice financial summary" })).toContainText(/SYP\s*0/);
    await expect(page.getByRole("button", { name: "Record payment" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Cancel invoice" })).toHaveCount(0);

    const cancellable = await invoiceBySearch(page, "staff", "Comprehensive restorative treatment");
    await page.goto(`/staff/billing/invoices/${cancellable.id}`);
    await page.getByRole("button", { name: "Cancel invoice" }).click();
    const cancelDialog = page.getByRole("dialog", { name: "Cancel invoice" });
    const cancelResponse = page.waitForResponse((response) => new URL(response.url()).pathname.endsWith(`/api/invoices/${cancellable.id}/cancel/`) && response.request().method() === "POST" && response.ok());
    await cancelDialog.getByRole("button", { name: "Cancel invoice" }).click();
    await cancelResponse;
    await expect(page.getByText("CANCELLED", { exact: true }).first()).toBeVisible();
    await page.goto("/staff/billing/overview");
    await expect.poll(() => openInvoiceCount(page)).toBe(initialOpenCount - 2);
    await page.goto(`/staff/patients/${invoice.patient.id}?tab=billing`);
    await expect(page.getByRole("row", { name: new RegExp(invoice.invoice_number) })).toContainText("PAID");
    await page.goto("/staff/dashboard");
    await expectNoOverflow(page);
  });

  test("Admin stays read-only, refreshes cross-user changes, and prints a contained document", async ({ page, browser }) => {
    test.setTimeout(75_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page, "admin");
    const invoice = await invoiceBySearch(page, "admin", "Historical automatic root-canal treatment");
    await page.goto(`/admin/billing/invoices/${invoice.id}`);
    await expect(page.getByText("Admin access is read-only.")).toBeVisible();
    await expect(page.getByRole("button", { name: /Record payment|Edit invoice|Cancel invoice/ })).toHaveCount(0);
    await expect(page.getByText("UNPAID", { exact: true }).first()).toBeVisible();

    const staffContext = await browser.newContext({ baseURL, viewport: { width: 1280, height: 720 } });
    try {
      const staffPage = await staffContext.newPage();
      await login(staffPage, "staff");
      await staffPage.goto(`/staff/billing/invoices/${invoice.id}`);
      await staffPage.getByRole("button", { name: "Record payment" }).click();
      const paymentDialog = staffPage.getByRole("dialog", { name: "Record payment" });
      await paymentDialog.getByRole("textbox", { name: "Amount" }).fill("1.00");
      const paymentResponse = staffPage.waitForResponse((response) => new URL(response.url()).pathname.endsWith(`/api/invoices/${invoice.id}/payments/`) && response.request().method() === "POST" && response.status() === 201);
      await paymentDialog.getByRole("button", { name: "Record payment" }).click();
      await paymentResponse;
    } finally {
      await closeContext(staffContext);
    }
    await page.bringToFront();
    expect(await page.evaluate(() => document.visibilityState)).toBe("visible");
    const focusRefresh = page.waitForResponse((response) => new URL(response.url()).pathname.endsWith(`/api/invoices/${invoice.id}/`) && response.request().method() === "GET" && response.ok());
    await page.evaluate(() => window.dispatchEvent(new Event("visibilitychange")));
    await focusRefresh;
    await expect(page.getByText("PARTIALLY PAID", { exact: true }).first()).toBeVisible();

    await page.goto(`/admin/billing/invoices/${invoice.id}/print`);
    const document = page.locator(".invoice-document");
    await expect(document).toBeVisible();
    await expect(document.getByText("INVOICE", { exact: true })).toBeVisible();
    await expect(document.getByText("Description", { exact: true })).toBeVisible();
    await expect(document.getByText("Balance due", { exact: true })).toBeVisible();
    const size = await document.evaluate((element) => ({ width: element.getBoundingClientRect().width, overflow: element.scrollWidth > element.clientWidth + 1 }));
    expect(size.width).toBeGreaterThan(700);
    expect(size.width).toBeLessThan(900);
    expect(size.overflow).toBe(false);
    await expectNoOverflow(page);
  });

  test("Doctor completion creates the immediate unpaid invoice", async ({ page, browser }) => {
    test.setTimeout(75_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page, "doctor");
    await page.goto("/doctor/visits/active");
    await expect(page.getByText("Lina Mansour").first()).toBeVisible();
    await expect(page.getByRole("tab", { name: "Billing" })).toBeVisible();
    await page.getByRole("tab", { name: "Billing" }).click();
    await page.getByLabel("Treatment / invoice description").fill("Stage 6 completed visit treatment");
    await page.getByLabel("Total treatment charge").fill("125000.00");
    await page.getByLabel("Currency").selectOption("SYP");
    await page.getByLabel("Billing note").fill("Immediate invoice verification");
    await page.getByRole("button", { name: "Complete Visit" }).click();
    await expect(page.getByText("an unpaid invoice will be created immediately", { exact: false })).toBeVisible();
    const completionResponse = page.waitForResponse((response) => /\/api\/visits\/\d+\/complete\/$/.test(new URL(response.url()).pathname) && response.request().method() === "POST" && response.ok());
    await page.getByRole("button", { name: "Complete Visit and Create Invoice" }).click();
    const payload = await (await completionResponse).json() as {
      visit: { id: number; status: string; patient: { id: number }; appointment: { status: string } };
      created_invoice: { id: number; invoice_number: string; status: string; origin: string };
      billing_provenance: { status: string };
    };
    expect(payload.visit.status).toBe("COMPLETED");
    expect(payload.visit.appointment.status).toBe("COMPLETED");
    expect(payload.created_invoice.status).toBe("UNPAID");
    expect(payload.created_invoice.origin).toBe("VISIT_COMPLETION");
    expect(payload.billing_provenance.status).toBe("CONVERTED_TO_INVOICE");
    await expect(page.getByText(payload.created_invoice.invoice_number)).toBeVisible();
    await expect(page.getByText("Visit completed and the invoice was created immediately.")).toBeVisible();

    const records = await page.evaluate(async ({ visitId }) => {
      const auth = JSON.parse(localStorage.getItem("pearlix-auth") || "{}") as { state?: { accessToken?: string } };
      const headers = { Authorization: `Bearer ${auth.state?.accessToken ?? ""}` };
      const handoffResponse = await fetch(`http://127.0.0.1:8000/api/billing-handoffs/?visit_id=${visitId}`, { headers });
      const handoffs = await handoffResponse.json() as { count: number; results: Array<{ status: string }> };
      return {
        handoffCount: handoffs.count,
        handoffStatuses: handoffs.results.map((item) => item.status),
      };
    }, { visitId: payload.visit.id });
    expect(records.handoffCount).toBe(1);
    expect(records.handoffStatuses).toEqual(["CONVERTED_TO_INVOICE"]);

    const staffContext = await browser.newContext({ baseURL, viewport: { width: 1280, height: 720 } });
    try {
      const staffPage = await staffContext.newPage();
      await login(staffPage, "staff");
      const staffInvoice = await invoiceBySearch(staffPage, "staff", payload.created_invoice.invoice_number);
      expect(staffInvoice.id).toBe(payload.created_invoice.id);
      await staffPage.goto("/staff/billing/overview");
      await expect(staffPage.getByText(payload.created_invoice.invoice_number).first()).toBeVisible();
      await staffPage.goto(`/staff/patients/${payload.visit.patient.id}?tab=billing`);
      await expect(staffPage.getByText(payload.created_invoice.invoice_number)).toBeVisible();
      await expect(staffPage.getByText("Convert to invoice")).toHaveCount(0);
    } finally {
      await closeContext(staffContext);
    }
  });
});
