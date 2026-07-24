import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { usersApi } from "../../../api/endpoints/users";
import { useAuthStore } from "../../../auth/authStore";
import { AdminNewUserPage, AdminUserListPage } from "./UserPages";

const account = { id: 4, full_name: "Amina Admin", email: "amina@example.test", role: "ADMIN" as const, is_active: true, must_change_password: false, password_changed_at: null, theme_preference: "LIGHT" as const, language_preference: "EN" as const, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z", version: 1, linked_profile_state: "NONE" as const, team_member_id: null };
function renderPage(page: React.ReactNode) { const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); return render(<QueryClientProvider client={client}><MemoryRouter>{page}</MemoryRouter></QueryClientProvider>); }

describe("Users & Access pages", () => {
  beforeEach(() => useAuthStore.setState({ user: { id: 1, full_name: "Admin", email: "admin@example.test", role: "ADMIN", is_active: true, must_change_password: false, password_changed_at: null, theme_preference: "LIGHT", language_preference: "EN" } }));
  afterEach(() => vi.restoreAllMocks());
  it("renders account rows separately from Team profiles", async () => { vi.spyOn(usersApi, "list").mockResolvedValue({ count: 1, next: null, previous: null, results: [account] }); renderPage(<AdminUserListPage />); expect(await screen.findByText("Amina Admin")).toBeInTheDocument(); expect(screen.getByRole("heading", { name: /Accounts/ })).toBeInTheDocument(); });
  it("offers only Admin account creation and sends ADMIN", async () => { const create = vi.spyOn(usersApi, "create").mockResolvedValue(account); renderPage(<AdminNewUserPage />); expect(screen.queryByRole("option", { name: "Doctor" })).not.toBeInTheDocument(); expect(screen.queryByRole("option", { name: "Staff" })).not.toBeInTheDocument(); fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "New Admin" } }); fireEvent.change(screen.getByLabelText("Email"), { target: { value: "new@example.test" } }); fireEvent.change(screen.getByLabelText("Temporary password"), { target: { value: "StrongPassword!1" } }); fireEvent.click(screen.getByRole("button", { name: "Create Admin account" })); await waitFor(() => expect(create).toHaveBeenCalled()); expect(create.mock.calls[0]?.[0]).toEqual({ full_name: "New Admin", email: "new@example.test", temporary_password: "StrongPassword!1", role: "ADMIN" }); });
  it("renders localized Arabic Users & Access headings", async () => { useAuthStore.setState((state) => ({ user: { ...state.user!, language_preference: "AR" } })); vi.spyOn(usersApi, "list").mockResolvedValue({ count: 0, next: null, previous: null, results: [] }); renderPage(<AdminUserListPage />); expect(await screen.findByText("المستخدمون والصلاحيات")).toBeInTheDocument(); });
});
