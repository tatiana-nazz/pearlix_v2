import { expect, test, type Page } from "@playwright/test";

const password = process.env.PEARLIX_E2E_PASSWORD;
const accounts = {
  admin: "admin@pearlix-demo.local",
  staff: "staff.one@pearlix-demo.local",
} as const;

type UserRow = { id: number; full_name: string; email: string; role: "ADMIN" | "DOCTOR" | "STAFF"; is_active: boolean; team_member_id: number | null };
type TeamRow = { id: number; full_name: string; role: "DOCTOR" | "STAFF" };

async function login(page: Page, role: keyof typeof accounts) {
  if (!password) throw new Error("PEARLIX_E2E_PASSWORD must be set.");
  await page.goto("/login");
  await page.getByLabel("Email").fill(accounts[role]);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(new RegExp(`/${role}/dashboard$`));
  const english = page.getByRole("button", { name: "EN", exact: true });
  if (await english.getAttribute("aria-pressed") !== "true") await english.click();
  if (await page.locator("html").getAttribute("data-theme") !== "light") await page.locator(".theme-toggle").click();
}

async function expectNoOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  await expect(page.locator(".vite-error-overlay, #webpack-dev-server-client-overlay, [data-nextjs-dialog]")).toHaveCount(0);
}

async function openUsersAndResolve(page: Page) {
  const responsePromise = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/users/" && response.request().method() === "GET" && response.ok());
  await page.goto("/admin/users");
  const payload = await (await responsePromise).json() as { results: UserRow[] };
  await expect(page.getByRole("heading", { name: "Users & Access" })).toBeVisible();
  return payload.results;
}

async function openTeamAndResolve(page: Page, role: "admin" | "staff") {
  const responsePromise = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/team-members/" && response.request().method() === "GET" && response.ok());
  await page.goto(`/${role}/team`);
  const payload = await (await responsePromise).json() as { results: TeamRow[] };
  await expect(page.getByRole("heading", { name: "Team", exact: true })).toBeVisible();
  return payload.results;
}

test.describe("admin users and team management", () => {
  test("admin users list and compact user detail", async ({ page }) => {
    test.setTimeout(40_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page, "admin");
    const users = await openUsersAndResolve(page);
    for (const column of ["Name", "Email", "Role", "Login status", "Password", "Profile", "Created"]) await expect(page.getByRole("columnheader", { name: column, exact: true })).toBeVisible();
    for (const filter of ["Search", "Role", "Login status"]) await expect(page.getByLabel(filter, { exact: true })).toBeVisible();
    const target = users.find((user) => user.role === "DOCTOR" && user.team_member_id) ?? users.find((user) => user.role === "STAFF" && user.team_member_id);
    expect(target, "a linked Doctor or Staff account must exist in the demo seed").toBeTruthy();
    await page.getByRole("row", { name: new RegExp(target!.full_name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/users/${target!.id}$`));
    await expect(page.getByRole("heading", { name: target!.full_name, exact: true })).toBeVisible();
    for (const section of ["Account identity", "Effective Access", "Security & Login", "Linked Team Profile", "Role & Access Change", "Account metadata"]) await expect(page.getByRole("heading", { name: section, exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Save account" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Reset temporary password" })).toBeVisible();
    await expect(page.getByRole("button", { name: /activate account/i })).toBeVisible();
    await expect(page.locator(".effective-access-list")).toHaveAttribute("data-saved-role", target!.role);
    await expect(page.getByRole("link", { name: "Open Team profile" })).toHaveAttribute("href", `/admin/team/${target!.team_member_id}`);
    expect((await page.locator(".user-management-grid").evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length))).toBe(2);
    await expectNoOverflow(page);
  });

  test("role change save and review workflow", async ({ page }) => {
    test.setTimeout(40_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page, "admin");
    const users = await openUsersAndResolve(page);
    const target = users.find((user) => user.email !== accounts.admin && user.role !== "ADMIN") ?? users.find((user) => user.email !== accounts.admin);
    expect(target, "a non-current account must exist in the demo seed").toBeTruthy();
    await page.getByRole("row", { name: new RegExp(target!.full_name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) }).click();
    const savedRole = await page.locator(".user-management-header .role-chip").innerText();
    const savedAccessRole = await page.locator(".effective-access-list").getAttribute("data-saved-role");
    const newRole = target!.role === "ADMIN" ? "STAFF" : "ADMIN";
    await page.getByLabel("New role").selectOption(newRole);
    await expect(page.locator(".user-management-header .role-chip")).toHaveText(savedRole);
    await expect(page.locator(".effective-access-list")).toHaveAttribute("data-saved-role", savedAccessRole!);
    await expect(page.getByRole("dialog", { name: "Review role change" })).toHaveCount(0);
    await page.getByRole("button", { name: "Save role change" }).click();
    const review = page.getByRole("dialog", { name: "Review role change" });
    await expect(review).toBeVisible();
    await expect(review.getByRole("heading", { name: "Consequences" })).toBeVisible();
    await expect(review.getByRole("heading", { name: "Operational history" })).toBeVisible();
    await expect(review.getByRole("heading", { name: "Blockers" })).toBeVisible();
    await expect(page.locator(".user-management-header .role-chip")).toHaveText(savedRole);
    await review.getByRole("button", { name: "Cancel" }).click();
    await expect(review).toHaveCount(0);
    await expect(page.locator(".effective-access-list")).toHaveAttribute("data-saved-role", savedAccessRole!);
    await expectNoOverflow(page);
  });

  test("admin team detail read and edit modes", async ({ page }) => {
    test.setTimeout(40_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page, "admin");
    const members = await openTeamAndResolve(page, "admin");
    const member = members.find((row) => row.role === "DOCTOR") ?? members[0];
    expect(member, "a Team member must exist in the demo seed").toBeTruthy();
    await page.getByRole("link", { name: new RegExp(member.full_name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/team/${member.id}$`));
    for (const section of ["Professional information", "Contact", "Today's workload", "Professional status", "Schedule", "Leave / availability"]) await expect(page.getByRole("heading", { name: section, exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit professional profile" })).toBeVisible();
    const editField = member.role === "DOCTOR" ? "Specialty" : "Position";
    await expect(page.getByLabel(editField)).toHaveCount(0);
    await page.getByRole("button", { name: "Edit professional profile" }).click();
    const field = page.getByLabel(editField);
    const original = await field.inputValue();
    await field.fill(`${original} local edit`);
    await expect(page.getByRole("button", { name: "Save changes" })).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(field).toHaveCount(0);
    await page.getByRole("button", { name: "Edit professional profile" }).click();
    await expect(page.getByLabel(editField)).toHaveValue(original);
    await expectNoOverflow(page);
  });

  test("staff team remains read only", async ({ page }) => {
    test.setTimeout(40_000);
    await page.setViewportSize({ width: 1280, height: 720 });
    await login(page, "staff");
    const members = await openTeamAndResolve(page, "staff");
    const member = members[0];
    expect(member, "a Staff-visible Team member must exist in the demo seed").toBeTruthy();
    await page.getByRole("link", { name: new RegExp(member.full_name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) }).click();
    await expect(page).toHaveURL(new RegExp(`/staff/team/${member.id}$`));
    await expect(page.getByRole("heading", { name: "Professional information" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Schedule" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit professional profile" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /professional profile/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Open Users & Access" })).toHaveCount(0);
    await expect(page.getByText(/Reset temporary password|Role & Access Change/)).toHaveCount(0);
    await expectNoOverflow(page);
  });

  test("users and team theme rtl responsive layout", async ({ page }) => {
    test.setTimeout(55_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page, "admin");
    const users = await openUsersAndResolve(page);
    const user = users.find((row) => row.role === "DOCTOR" && row.team_member_id) ?? users.find((row) => row.team_member_id);
    expect(user).toBeTruthy();
    await page.getByRole("row", { name: new RegExp(user!.full_name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) }).click();
    const lightUser = await page.locator(".user-management-header").evaluate((element) => getComputedStyle(element).backgroundColor);
    await page.locator(".theme-toggle").click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    const darkUser = await page.locator(".user-management-header").evaluate((element) => getComputedStyle(element).backgroundColor);
    expect(darkUser).not.toBe(lightUser);
    await page.goto(`/admin/team/${user!.team_member_id}`);
    await expect(page.getByRole("heading", { name: user!.full_name, exact: true })).toBeVisible();
    const darkTeam = await page.locator(".team-profile-header").evaluate((element) => getComputedStyle(element).backgroundColor);
    await page.locator(".theme-toggle").click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    const lightTeam = await page.locator(".team-profile-header").evaluate((element) => getComputedStyle(element).backgroundColor);
    expect(lightTeam).not.toBe(darkTeam);
    await page.getByRole("button", { name: "AR", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: "المعلومات المهنية" })).toBeVisible();
    expect(await page.locator(".team-contact-card dd[dir='ltr']").first().evaluate((element) => getComputedStyle(element).direction)).toBe("ltr");
    for (const viewport of [{ width: 1440, height: 900 }, { width: 1280, height: 720 }, { width: 1024, height: 768 }]) {
      await page.setViewportSize(viewport);
      await expectNoOverflow(page);
      const columnCount = await page.locator(".team-detail-upper-grid").evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length);
      expect(columnCount).toBe(viewport.width === 1024 ? 1 : 2);
    }
    await page.goto(`/admin/users/${user!.id}`);
    await expect(page.getByRole("heading", { name: "الصلاحيات الفعلية" })).toBeVisible();
    expect(await page.locator(".user-management-header p[dir='ltr']").evaluate((element) => getComputedStyle(element).direction)).toBe("ltr");
    for (const viewport of [{ width: 1440, height: 900 }, { width: 1280, height: 720 }, { width: 1024, height: 768 }]) {
      await page.setViewportSize(viewport);
      await expectNoOverflow(page);
      const columnCount = await page.locator(".user-management-grid").evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length);
      expect(columnCount).toBe(viewport.width === 1024 ? 1 : 2);
    }
  });
});
