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
  remaining_amount: string;
  invoice_count: number;
  patient: { id: number; full_name: string };
  visit: { id: number; appointment: { id: number } } | null;
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

test.describe("Visit-only Bill origin authority", () => {
  test("Staff Billing exposes no New Bill workflow", async ({ page }) => {
    await login(page, "staff");
    for (const path of ["/staff/dashboard", "/staff/billing/overview", "/staff/billing/handoffs"]) {
      await page.goto(path);
      await expect(page.getByRole("link", { name: /new bill/i })).toHaveCount(0);
      await expect(page.getByRole("button", { name: /new bill/i })).toHaveCount(0);
    }
    await page.goto("/staff/billing/handoffs/new");
    await expect(page).toHaveURL("/staff/billing/handoffs");
    await expect(page.getByRole("heading", { name: "Handoff history" })).toBeVisible();
  });

  test("Patient Billing has no create Bill action", async ({ page }) => {
    await login(page, "staff");
    const bill = await findBill(page, "Orthodontic consultation");
    await page.goto(`/staff/patients/${bill.patient.id}?tab=billing`);
    await expect(page.getByRole("heading", { name: "Handoffs" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Invoices", exact: true })).toBeVisible();
    await expect(page.getByText("Orthodontic consultation")).toBeVisible();
    await expect(page.getByRole("link", { name: /new bill/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /new bill/i })).toHaveCount(0);
  });

  test("Staff Handoff Detail exposes only Record Payment mutation", async ({ page }) => {
    await login(page, "staff");
    const bill = await findBill(page, "Comprehensive restorative treatment");
    await page.goto(`/staff/billing/handoffs/${bill.id}`);
    await expect(page.getByRole("button", { name: "Record payment" })).toBeVisible();
    await expect(page.getByRole("button", { name: /edit bill/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /cancel bill/i })).toHaveCount(0);
    await page.getByRole("button", { name: "Record payment" }).click();
    const dialog = page.getByRole("dialog", { name: "Record payment & issue invoice" });
    await expect(dialog.getByText(bill.patient.full_name)).toBeVisible();
    await expect(dialog.getByRole("combobox", { name: /patient|currency|treatment/i })).toHaveCount(0);
    await dialog.getByRole("button", { name: "Cancel" }).click();
  });

  test("Record Payment creates an Invoice receipt", async ({ page }) => {
    await login(page, "staff");
    const bill = await findBill(page, "Comprehensive restorative treatment");
    await page.goto(`/staff/billing/handoffs/${bill.id}`);
    await page.getByRole("button", { name: "Record payment" }).click();
    const dialog = page.getByRole("dialog", { name: "Record payment & issue invoice" });
    await dialog.getByLabel("Payment amount").fill("5000.00");
    await dialog.getByLabel("Notes (optional)").fill("Visit-only authority receipt");
    const response = page.waitForResponse((item) =>
      new URL(item.url()).pathname.endsWith(`/api/billing-handoffs/${bill.id}/invoices/`)
      && item.request().method() === "POST"
      && item.status() === 201,
    );
    await dialog.getByRole("button", { name: "Record payment & issue invoice" }).click();
    const payload = await (await response).json() as { invoice: { invoice_number: string }; handoff: Bill };
    expect(payload.handoff.invoice_count).toBe(bill.invoice_count + 1);
    await expect(page.getByText(payload.invoice.invoice_number, { exact: true })).toBeVisible();
    await expect(page.getByText("Visit-only authority receipt", { exact: true })).toBeVisible();
  });

  test("Admin Handoff Detail is read-only", async ({ page }) => {
    await login(page, "admin");
    const bill = await findBill(page, "Comprehensive restorative treatment");
    await page.goto(`/admin/billing/handoffs/${bill.id}`);
    await expect(page.getByRole("heading", { name: `Bill #${bill.id}` })).toBeVisible();
    await expect(page.getByRole("button", { name: /record payment|edit bill|cancel bill/i })).toHaveCount(0);
  });

  test("Doctor Handoff Detail is read-only", async ({ page }) => {
    await login(page, "doctor");
    const bill = await findBill(page, "Comprehensive restorative treatment");
    await page.goto(`/doctor/billing/handoffs/${bill.id}`);
    await expect(page.getByRole("heading", { name: `Bill #${bill.id}` })).toBeVisible();
    await expect(page.getByRole("button", { name: /record payment|edit bill|cancel bill/i })).toHaveCount(0);
  });

  test("Doctor Active Visit completion creates one OPEN Handoff", async ({ page }) => {
    test.setTimeout(60_000);
    await login(page, "doctor");
    await page.goto("/doctor/visits/active");
    await expect(page.getByText("Lina Mansour").first()).toBeVisible();
    await page.getByRole("tab", { name: "Billing" }).click();
    await page.getByLabel("Treatment / bill description").fill("Visit-only E2E completed visit bill");
    await page.getByLabel("Total treatment charge").fill("125000.00");
    await page.getByLabel("Currency").selectOption("SYP");
    await page.getByLabel("Billing note").fill("Created only by Doctor Visit completion");
    await page.getByRole("button", { name: "Complete Visit" }).click();
    const dialog = page.getByRole("dialog", { name: "Complete this visit?" });
    const response = page.waitForResponse((item) =>
      /\/api\/visits\/\d+\/complete\/$/.test(new URL(item.url()).pathname)
      && item.request().method() === "POST"
      && item.ok(),
    );
    await dialog.getByRole("button", { name: "Complete Visit and Create Bill" }).click();
    const payload = await (await response).json() as { visit: { id: number; status: string; appointment: { status: string } }; created_handoff: Bill };
    expect(payload.visit.status).toBe("COMPLETED");
    expect(payload.visit.appointment.status).toBe("COMPLETED");
    expect(payload.created_handoff.status).toBe("OPEN");
    expect(payload.created_handoff.invoice_count).toBe(0);
    const records = await apiGet<{ count: number; results: Bill[] }>(page, `billing-handoffs/?visit_id=${payload.visit.id}`);
    expect(records.count).toBe(1);
  });

  test("Fresh Staff session sees the completed-Visit Handoff and can issue an Invoice", async ({ page }) => {
    await login(page, "staff");
    const bill = await findBill(page, "Visit-only E2E completed visit bill");
    expect(bill.status).toBe("OPEN");
    expect(bill.invoice_count).toBe(0);
    await page.goto(`/staff/billing/handoffs/${bill.id}`);
    await page.getByRole("button", { name: "Record payment" }).click();
    const dialog = page.getByRole("dialog", { name: "Record payment & issue invoice" });
    await dialog.getByLabel("Payment amount").fill("25000.00");
    const response = page.waitForResponse((item) =>
      new URL(item.url()).pathname.endsWith(`/api/billing-handoffs/${bill.id}/invoices/`)
      && item.request().method() === "POST"
      && item.status() === 201,
    );
    await dialog.getByRole("button", { name: "Record payment & issue invoice" }).click();
    const payload = await (await response).json() as { invoice: { invoice_number: string }; handoff: Bill };
    expect(payload.handoff.status).toBe("PARTIALLY_PAID");
    await expect(page.getByText(payload.invoice.invoice_number, { exact: true })).toBeVisible();
  });
});
