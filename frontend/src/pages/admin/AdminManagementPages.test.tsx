import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { teamApi } from "../../api/endpoints/team";
import { usersApi } from "../../api/endpoints/users";
import { AdminUserDetailPage } from "./AdminManagementPages";

vi.mock("../../api/endpoints/users", () => ({ usersApi: { detail: vi.fn(), resetPassword: vi.fn(), deactivate: vi.fn(), reactivate: vi.fn(), list: vi.fn(), create: vi.fn() } }));
vi.mock("../../api/endpoints/team", () => ({ teamQueryKeys: { all: ["team-members"], detail: (id: number) => ["team-members", id] }, teamApi: { previewRoleTransition: vi.fn(), confirmRoleTransition: vi.fn() } }));

const account = {
  id: 12, email: "admin@example.test", full_name: "Nour Admin", role: "ADMIN" as const, is_active: true, must_change_password: false, password_changed_at: null,
  theme_preference: "LIGHT" as const, language_preference: "EN" as const, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z", version: 4, linked_profile_state: "NONE" as const, team_member_id: null,
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={["/admin/users/12"]}><Routes><Route path="/admin/users/:userId" element={<AdminUserDetailPage />} /></Routes></MemoryRouter></QueryClientProvider>);
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
});
