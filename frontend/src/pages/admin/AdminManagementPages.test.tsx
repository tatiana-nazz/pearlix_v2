import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { teamApi } from "../../api/endpoints/team";
import { usersApi } from "../../api/endpoints/users";
import { AdminNewUserPage, AdminUserDetailPage, AdminUserListPage } from "./AdminManagementPages";

vi.mock("../../api/endpoints/users", () => ({ usersApi: { detail: vi.fn(), resetPassword: vi.fn(), deactivate: vi.fn(), reactivate: vi.fn(), list: vi.fn(), create: vi.fn() } }));
vi.mock("../../api/endpoints/team", () => ({ teamQueryKeys: { all: ["team-members"], detail: (id: number) => ["team-members", id] }, teamApi: { previewRoleTransition: vi.fn(), confirmRoleTransition: vi.fn() } }));

const account = {
  id: 12, email: "admin@example.test", full_name: "Nour Admin", role: "ADMIN" as const, is_active: true, must_change_password: false, password_changed_at: null,
  theme_preference: "LIGHT" as const, language_preference: "EN" as const, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z", version: 4, linked_profile_state: "NONE" as const, team_member_id: null,
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return { client, ...render(<QueryClientProvider client={client}><MemoryRouter initialEntries={["/admin/users/12"]}><Routes><Route path="/admin/users/:userId" element={<AdminUserDetailPage />} /></Routes></MemoryRouter></QueryClientProvider>) };
}

function renderUsersPage(entry: "/admin/users" | "/admin/users/new") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[entry]}><Routes><Route path="/admin/users" element={<AdminUserListPage />} /><Route path="/admin/users/new" element={<AdminNewUserPage />} /><Route path="/admin/users/:userId" element={<p>Account detail route</p>} /><Route path="/admin/team" element={<p>Team onboarding route</p>} /></Routes></MemoryRouter></QueryClientProvider>);
}

function mockAccount() {
  vi.mocked(usersApi.detail).mockResolvedValue(account);
  vi.mocked(usersApi.resetPassword).mockRejectedValue(new Error("Password service unavailable"));
  vi.mocked(usersApi.deactivate).mockResolvedValue(account);
  vi.mocked(usersApi.reactivate).mockResolvedValue(account);
}

describe("Users and access production workflow", () => {
  it("shows localized known role blockers and record counts without backend codes", async () => {
    mockAccount();
    vi.mocked(teamApi.previewRoleTransition).mockResolvedValue({
      current_role: "ADMIN", target_role: "DOCTOR", linked_profile_state: "NONE", operational_history: { working_shifts: 2, appointments: 3, visits: 0 }, required_target_profile: "doctor_profile",
      allowed: false, confirmation_token: null, consequences: [], blockers: [{ code: "ROLE_TRANSITION_BLOCKED_BY_HISTORY", counts: { working_shifts: 2, appointments: 3, visits: 0 } }],
    });
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Change role" }));
    fireEvent.click(screen.getByRole("button", { name: "Preview transition" }));

    expect(await screen.findByText("Existing operational history prevents this role change.")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Related records" })).toHaveTextContent("Working shifts: 2");
    expect(screen.getByRole("list", { name: "Related records" })).toHaveTextContent("Appointments: 3");
    expect(screen.queryByText("ROLE_TRANSITION_BLOCKED_BY_HISTORY")).not.toBeInTheDocument();
  });

  it("clears a reset secret on normal close or discard, but retains it while editing and after a failed request", async () => {
    mockAccount();
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Reset temporary password" }));
    let password = screen.getByLabelText("Temporary password");
    await user.type(password, "Temporary123");
    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.click(screen.getByRole("button", { name: "Discard" }));
    await user.click(screen.getByRole("button", { name: "Reset temporary password" }));
    password = screen.getByLabelText("Temporary password");
    expect(password).toHaveValue("");

    await user.type(password, "Temporary123");
    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(screen.getByLabelText("Temporary password")).toHaveValue("Temporary123");
    await user.click(screen.getByRole("button", { name: "Reset password" }));

    expect(await screen.findByText("Password service unavailable")).toBeInTheDocument();
    expect(screen.getByLabelText("Temporary password")).toHaveValue("Temporary123");
    await waitFor(() => expect(usersApi.resetPassword).toHaveBeenCalledWith(12, { temporary_password: "Temporary123" }));
  });

  it("renders localized account rows, preserves row action isolation, and supports keyboard account navigation", async () => {
    vi.mocked(usersApi.list).mockResolvedValue({ count: 1, next: null, previous: null, results: [account] });
    renderUsersPage("/admin/users");

    const rowName = await screen.findByText("Nour Admin");
    expect(rowName).toHaveClass("bidi-isolate");
    expect(screen.getByText("Admin")).toBeInTheDocument();
    fireEvent.keyDown(rowName.closest("tr")!, { key: "Enter" });
    expect(await screen.findByText("Account detail route")).toBeInTheDocument();
  });

  it("creates an Admin with the exact production payload and routes Doctor onboarding to Team", async () => {
    const user = userEvent.setup();
    vi.mocked(usersApi.create).mockResolvedValue(account);
    renderUsersPage("/admin/users/new");

    await user.type(screen.getByLabelText("Full name"), "Nour Admin");
    await user.type(screen.getByLabelText("Login email"), "admin@example.test");
    await user.type(screen.getByLabelText("Temporary password"), "Temporary123");
    await user.click(screen.getByRole("button", { name: "Create Admin account" }));
    await waitFor(() => expect(usersApi.create).toHaveBeenCalledWith({ full_name: "Nour Admin", email: "admin@example.test", role: "ADMIN", temporary_password: "Temporary123" }));
    expect(await screen.findByText("Account detail route")).toBeInTheDocument();

    renderUsersPage("/admin/users/new");
    await user.selectOptions(screen.getByLabelText("System role"), "DOCTOR");
    expect(screen.getByRole("link", { name: "Add team member" })).toHaveAttribute("href", "/admin/team");
  });

  it("clears a successfully reset password and sends exact deactivate/reactivate calls", async () => {
    mockAccount();
    vi.mocked(usersApi.resetPassword).mockResolvedValue(account);
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Reset temporary password" }));
    await user.type(screen.getByLabelText("Temporary password"), "Temporary123");
    await user.click(screen.getByRole("button", { name: "Reset password" }));
    await waitFor(() => expect(usersApi.resetPassword).toHaveBeenCalledWith(12, { temporary_password: "Temporary123" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Reset temporary password" })).not.toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Deactivate account" }));
    await user.click(screen.getAllByRole("button", { name: "Deactivate account" })[1]!);
    await waitFor(() => expect(usersApi.deactivate).toHaveBeenCalledWith(12));
    vi.mocked(usersApi.detail).mockResolvedValue({ ...account, is_active: false });
    const second = renderPage();
    await user.click(await screen.findByRole("button", { name: "Reactivate account" }));
    await waitFor(() => expect(usersApi.reactivate).toHaveBeenCalledWith(12));
    second.unmount();
  });

  it("locks the reset-password dialog while the request is pending", async () => {
    let finishReset: (result: typeof account) => void = () => undefined;
    vi.clearAllMocks();
    mockAccount();
    vi.mocked(usersApi.resetPassword).mockImplementation(() => new Promise((resolve) => { finishReset = resolve; }));
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Reset temporary password" }));
    await user.type(screen.getByLabelText("Temporary password"), "Temporary123");
    await user.click(screen.getByRole("button", { name: "Reset password" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Close" })).toBeDisabled());
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("dialog", { name: "Reset temporary password" })).toBeInTheDocument();
    finishReset(account);
    await waitFor(() => expect(usersApi.resetPassword).toHaveBeenCalledTimes(1));
  });

  it("confirms an allowed role transition with token, version, profile payload, and query invalidation", async () => {
    mockAccount();
    vi.mocked(teamApi.previewRoleTransition).mockResolvedValue({
      current_role: "ADMIN", target_role: "DOCTOR", linked_profile_state: "NONE", operational_history: {}, required_target_profile: "doctor_profile", allowed: true, confirmation_token: "transition-token", consequences: ["A matching professional profile will be created"], blockers: [],
    });
    vi.mocked(teamApi.confirmRoleTransition).mockResolvedValue({ ...account, role: "DOCTOR", linked_profile_state: "DOCTOR" });
    const { client } = renderPage();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const user = userEvent.setup();
    const trigger = await screen.findByRole("button", { name: "Change role" }); trigger.focus();
    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: "Preview transition" }));
    await user.type(screen.getByLabelText("Specialty"), "Endodontics");
    await user.type(screen.getByLabelText("Phone"), "+963 11");
    await user.type(screen.getByLabelText("Biography"), "Profile text");
    await user.click(screen.getByRole("button", { name: "Confirm role transition" }));
    await waitFor(() => expect(teamApi.confirmRoleTransition).toHaveBeenCalledWith(12, { target_role: "DOCTOR", mode: "CONFIRM", confirmation_token: "transition-token", profile: { specialty: "Endodontics", phone: "+963 11", bio: "Profile text" }, version: 4 }));
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ["users"] }));
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
