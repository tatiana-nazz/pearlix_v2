import { expect, test, type Page } from "@playwright/test";

const password = process.env.PEARLIX_E2E_PASSWORD;
const accounts = {
  admin: "admin@pearlix-demo.local",
  staff: "staff.one@pearlix-demo.local",
  doctor: "doctor.one@pearlix-demo.local",
} as const;
type Role = keyof typeof accounts;

type Bill = {
  id: number;
  description: string;
  status: "OPEN" | "PARTIALLY_PAID" | "PAID" | "CANCELLED";
  total_amount: string;
  paid_amount: string;
  remaining_amount: string;
  invoice_count: number;
  patient: { id: number; full_name: string };
  visit: { id: number; appointment: { id: number } } | null;
};

type Receipt = {
  id: number;
  invoice_number: string;
  billing_handoff_id: number;
};

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

async function apiGet<T>(page: Page, endpoint: string): Promise<T> {
  return page.evaluate(async (path) => {
    const auth = JSON.parse(localStorage.getItem("pearlix-auth") || "{}") as { state?: { accessToken?: string } };
    const response = await fetch(`http://127.0.0.1:8000/api/${path}`, {
      headers: { Authorization: `Bearer ${auth.state?.accessToken ?? ""}` },
    });
    if (!response.ok) throw new Error(`GET ${path} failed with ${response.status}`);
    return response.json();
  }, endpoint) as Promise<T>;
}

async function findBill(page: Page, description: string): Promise<Bill> {
  const payload = await apiGet<{ results: Bill[] }>(page, `billing-handoffs/?search=${encodeURIComponent(description)}`);
  const bill = payload.results.find((item) => item.description === description);
  if (!bill) throw new Error(`Bill not found: ${description}`);
  return bill;
}

async function expectNoOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  await expect(page.locator(".vite-error-overlay, #webpack-dev-server-client-overlay")).toHaveCount(0);
}

test.describe("Stage 7 Handoff bill and Invoice receipt ledger", () => {
  test("Overview and the full Handoff history keep bills separate from receipts", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page, "staff");
    await page.goto("/staff/billing/overview");
    await expect(page.getByRole("navigation", { name: "Billing" }).getByRole("link")).toHaveText(["Overview", "Handoffs", "Invoices"]);
    await expect(page.getByRole("heading", { name: "Billing overview" })).toBeVisible();
    await expect(page.getByText("Open bills", { exact: true })).toBeVisible();
    await expect(page.getByText("Invoices today", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Recent bills" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Recent invoices" })).toBeVisible();
    await page.getByRole("link", { name: "Handoffs", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Handoff history" })).toBeVisible();
    await expect(page.getByText("6 records", { exact: true })).toBeVisible();
    for (const heading of ["Patient", "Treatment", "Doctor", "Bill total", "Paid", "Remaining", "Status", "Created"]) {
      await expect(page.getByRole("columnheader", { name: heading, exact: true })).toBeVisible();
    }
    await expect(page.getByText("Cancelled treatment estimate")).toBeVisible();
    await expectNoOverflow(page);
  });

  test("Handoff Detail is the bill workspace with patient, visit, and appointment navigation", async ({ page }) => {
    await login(page, "staff");
    const bill = await findBill(page, "Comprehensive restorative treatment");
    expect(bill.visit).not.toBeNull();
    await page.goto(`/staff/billing/handoffs/${bill.id}`);
    await expect(page.getByRole("heading", { name: `Bill #${bill.id}` })).toBeVisible();
    await expect(page.getByRole("region", { name: "Bill financial summary" })).toContainText("Remaining");
    await expect(page.getByRole("link", { name: "Open Patient" })).toHaveAttribute("href", `/staff/patients/${bill.patient.id}?tab=billing`);
    await expect(page.getByRole("link", { name: "Visit #" + bill.visit!.id })).toHaveAttribute("href", `/staff/visits/${bill.visit!.id}`);
    await expect(page.getByRole("link", { name: "Appointment #" + bill.visit!.appointment.id })).toHaveAttribute("href", `/staff/appointments/${bill.visit!.appointment.id}`);
    await expect(page.getByRole("heading", { name: "Issued invoices" })).toBeVisible();
    await expect(page.getByText("0 payment receipts")).toBeVisible();
    await page.getByRole("link", { name: "Open Patient" }).click();
    await expect(page).toHaveURL(`/staff/patients/${bill.patient.id}?tab=billing`);
    await expect(page.getByRole("tab", { name: "Billing" })).toHaveAttribute("aria-selected", "true");
    await page.goto(`/staff/billing/handoffs/${bill.id}`);
    await page.getByRole("link", { name: "Open Visit" }).click();
    await expect(page).toHaveURL(`/staff/visits/${bill.visit!.id}`);
  });

  test("A partial payment issues the first Invoice and updates the Handoff", async ({ page }) => {
    await login(page, "staff");
    const bill = await findBill(page, "Comprehensive restorative treatment");
    await page.goto(`/staff/billing/handoffs/${bill.id}`);
    await page.getByRole("button", { name: "Record payment & issue invoice" }).click();
    const dialog = page.getByRole("dialog", { name: "Record payment & issue invoice" });
    await expect(dialog.getByText(bill.patient.full_name)).toBeVisible();
    await expect(dialog.getByRole("combobox", { name: /patient|currency|treatment/i })).toHaveCount(0);
    await dialog.getByLabel("Payment amount").fill("50000.00");
    await dialog.getByLabel("Notes (optional)").fill("Stage 7 first partial collection");
    const response = page.waitForResponse((item) => new URL(item.url()).pathname.endsWith(`/api/billing-handoffs/${bill.id}/invoices/`) && item.request().method() === "POST" && item.status() === 201);
    await dialog.getByRole("button", { name: "Record payment & issue invoice" }).click();
    const payload = await (await response).json() as { invoice: Receipt; handoff: Bill };
    expect(payload.handoff.status).toBe("PARTIALLY_PAID");
    expect(payload.handoff.invoice_count).toBe(1);
    await expect(page.getByText("PARTIALLY PAID", { exact: true })).toBeVisible();
    await expect(page.getByText(payload.invoice.invoice_number, { exact: true })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Notes" })).toBeVisible();
    await expect(page.getByText("Stage 7 first partial collection")).toBeVisible();
  });

  test("Multiple Invoices settle a partially paid Handoff without changing bill identity", async ({ page }) => {
    await login(page, "staff");
    const bill = await findBill(page, "Multi-stage root-canal treatment");
    expect(bill.invoice_count).toBe(2);
    await page.goto(`/staff/billing/handoffs/${bill.id}`);
    await expect(page.getByText("2 payment receipts")).toBeVisible();
    await page.getByRole("button", { name: "Record payment & issue invoice" }).click();
    const dialog = page.getByRole("dialog", { name: "Record payment & issue invoice" });
    await dialog.getByRole("button", { name: "Pay remaining balance" }).click();
    await expect(dialog.getByLabel("Payment amount")).toHaveValue(bill.remaining_amount);
    const response = page.waitForResponse((item) => new URL(item.url()).pathname.endsWith(`/api/billing-handoffs/${bill.id}/invoices/`) && item.request().method() === "POST" && item.status() === 201);
    await dialog.getByRole("button", { name: "Record payment & issue invoice" }).click();
    const payload = await (await response).json() as { invoice: Receipt; handoff: Bill };
    expect(payload.handoff.id).toBe(bill.id);
    expect(payload.handoff.status).toBe("PAID");
    expect(payload.handoff.remaining_amount).toBe("0.00");
    expect(payload.handoff.invoice_count).toBe(3);
    await expect(page.getByText("PAID", { exact: true })).toBeVisible();
    await expect(page.getByText("Fully paid")).toBeVisible();
    await expect(page.getByText("3 payment receipts")).toBeVisible();
    await expect(page.getByRole("button", { name: "Record payment & issue invoice" })).toHaveCount(0);
  });

  test("Invoice Today, history, receipt detail, and print all describe one payment", async ({ page }) => {
    await login(page, "staff");
    await page.goto("/staff/billing/invoices");
    await page.getByRole("button", { name: "Today" }).click();
    await expect(page.getByRole("heading", { name: "Invoice history" })).toBeVisible();
    for (const heading of ["Invoice #", "Patient", "Handoff", "Payment date", "Amount", "Currency", "Issued by"]) {
      await expect(page.getByRole("columnheader", { name: heading, exact: true })).toBeVisible();
    }
    const row = page.locator("tbody .clickable-row").first();
    await expect(row).toBeVisible();
    const invoiceNumber = (await row.locator("td").first().innerText()).trim();
    await row.click();
    await expect(page.getByRole("heading", { name: invoiceNumber })).toBeVisible();
    await expect(page.getByText("Payment receipt", { exact: true })).toBeVisible();
    await expect(page.getByText("Invoices are immutable payment receipts.")).toBeVisible();
    await expect(page.getByRole("heading", { name: /Bill #/ })).toBeVisible();
    await page.getByRole("link", { name: "Print invoice" }).click();
    await expect(page.getByText("PAYMENT INVOICE", { exact: true })).toBeVisible();
    await expect(page.locator(".invoice-balance-row dt")).toHaveText("Payment received");
    await expect(page.getByText("Bill remaining", { exact: true })).toBeVisible();
  });

  test("Staff can create a manual Handoff bill without creating an Invoice", async ({ page }) => {
    await login(page, "staff");
    await page.goto("/staff/billing/handoffs/new");
    await page.getByRole("combobox", { name: "Patient" }).fill("Lina Mansour");
    await page.getByRole("option", { name: /^Lina Mansour/ }).click();
    await page.getByLabel("Treatment or service").fill("Stage 7 manual bill verification");
    await page.getByLabel("Bill total").fill("88000.00");
    await page.getByLabel("Currency").selectOption("SYP");
    await page.getByLabel("Notes (optional)").fill("No payment received at creation");
    const response = page.waitForResponse((item) => new URL(item.url()).pathname.endsWith("/api/billing-handoffs/") && item.request().method() === "POST" && item.status() === 201);
    await page.getByRole("button", { name: "Create bill" }).click();
    const created = await (await response).json() as Bill;
    expect(created.status).toBe("OPEN");
    expect(created.invoice_count).toBe(0);
    await expect(page).toHaveURL(`/staff/billing/handoffs/${created.id}`);
    await expect(page.getByText("0 payment receipts")).toBeVisible();
  });

  test("Patient Billing is Handoff-first and carries fixed patient context into New Bill", async ({ page }) => {
    await login(page, "staff");
    const bill = await findBill(page, "Orthodontic consultation");
    await page.goto(`/staff/patients/${bill.patient.id}?tab=billing`);
    await expect(page.getByRole("heading", { name: "Handoffs" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Invoices", exact: true })).toBeVisible();
    await expect(page.getByText("Orthodontic consultation")).toBeVisible();
    const newBill = page.getByRole("link", { name: "New bill for patient" });
    await expect(newBill).toHaveAttribute("href", `/staff/billing/handoffs/new?patient_id=${bill.patient.id}`);
    await page.goto(`/staff/billing/handoffs/new?patient_id=${bill.patient.id}`);
    await expect(page.getByText(bill.patient.full_name)).toBeVisible();
    await expect(page.getByText("The patient is fixed for this bill.")).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Patient" })).toHaveCount(0);
  });

  test("Doctor completion creates one OPEN Handoff and zero Invoices", async ({ page }) => {
    test.setTimeout(60_000);
    await login(page, "doctor");
    await page.goto("/doctor/visits/active");
    await expect(page.getByText("Lina Mansour").first()).toBeVisible();
    await page.getByRole("tab", { name: "Billing" }).click();
    await page.getByLabel("Treatment / bill description").fill("Stage 7 completed visit bill");
    await page.getByLabel("Total treatment charge").fill("125000.00");
    await page.getByLabel("Currency").selectOption("SYP");
    await page.getByLabel("Billing note").fill("Handoff only at completion");
    await page.getByRole("button", { name: "Complete Visit" }).click();
    const dialog = page.getByRole("dialog", { name: "Complete this visit?" });
    await expect(dialog.getByText("The visit and appointment will be completed, and one OPEN Handoff bill with zero invoices will be created.")).toBeVisible();
    const response = page.waitForResponse((item) => /\/api\/visits\/\d+\/complete\/$/.test(new URL(item.url()).pathname) && item.request().method() === "POST" && item.ok());
    await dialog.getByRole("button", { name: "Complete Visit and Create Bill" }).click();
    const payload = await (await response).json() as { visit: { id: number; status: string; appointment: { status: string } }; created_handoff: Bill };
    expect(payload.visit.status).toBe("COMPLETED");
    expect(payload.visit.appointment.status).toBe("COMPLETED");
    expect(payload.created_handoff.status).toBe("OPEN");
    expect(payload.created_handoff.invoice_count).toBe(0);
    await expect(page.getByText("Visit completed and the OPEN Handoff bill was created with zero invoices.")).toBeVisible();
    const records = await apiGet<{ count: number; results: Bill[] }>(page, `billing-handoffs/?visit_id=${payload.visit.id}`);
    expect(records.count).toBe(1);
    expect(records.results[0]?.invoice_count).toBe(0);
  });

  test("Billing remains responsive, dark-theme aware, and RTL safe", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await login(page, "admin");
    await page.goto("/admin/billing/invoices");
    const light = await page.locator(".billing-date-filter-card").evaluate((element) => getComputedStyle(element).backgroundColor);
    await page.locator(".theme-toggle").click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    const dark = await page.locator(".billing-date-filter-card").evaluate((element) => getComputedStyle(element).backgroundColor);
    expect(dark).not.toBe(light);
    await page.getByRole("button", { name: "AR", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: "سجل إيصالات الدفع" })).toBeVisible();
    await expect(page.locator(".billing-table .bidi-ltr").first()).toHaveCSS("direction", "ltr");
    await expectNoOverflow(page);
    await page.setViewportSize({ width: 1280, height: 720 });
    await expectNoOverflow(page);
  });
});
