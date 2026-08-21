import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { teamApi, teamQueryKeys } from "../../../api/endpoints/team";
import { usersApi } from "../../../api/endpoints/users";
import { useAuthStore } from "../../../auth/authStore";
import type { RoleTransitionPreview, TeamMemberDetail } from "../../../types/team";
import type { UserManagementRecord } from "../../../types/users";
import { AdminNewUserPage, AdminUserDetailPage, AdminUserListPage } from "./UserPages";

const baseAccount: UserManagementRecord = {
  id: 4,
  full_name: "Amina Admin",
  email: "amina@example.test",
  role: "ADMIN",
  is_active: true,
  must_change_password: false,
  password_changed_at: null,
  theme_preference: "LIGHT",
  language_preference: "EN",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-02T00:00:00Z",
  version: 7,
  linked_profile_state: "NONE",
  team_member_id: null,
};
const doctorAccount: UserManagementRecord = { ...baseAccount, id: 7, full_name: "Dr Noor", email: "noor@example.test", role: "DOCTOR", linked_profile_state: "DOCTOR", team_member_id: 7 };
const doctorMember: TeamMemberDetail = {
  id: 7,
  role: "DOCTOR",
  full_name: "Dr Noor",
  email: "noor@example.test",
  professional_status: "ACTIVE",
  specialty: "General Dentistry",
  position: null,
  phone: "+9631",
  account: { id: 7, email: "noor@example.test", is_active: true, must_change_password: false, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-02T00:00:00Z" },
  availability: { availability: "AVAILABLE", on_leave: false, next_exception: null },
  today_workload: { appointment_count: 2, active_visit_count: 1 },
  schedule_summary: [],
  active_shifts: [],
  current_future_leave: [],
  profile: { specialty: "General Dentistry", phone: "+9631", bio: "Bio", is_active: true },
  version: 3,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-02T00:00:00Z",
};

const allowedPreview = (target: "DOCTOR" | "STAFF"): RoleTransitionPreview => ({
  current_role: "ADMIN",
  target_role: target,
  linked_profile_state: "NONE",
  operational_history: { working_shifts: 0, doctor_availability_exceptions: 0, staff_availability_exceptions: 0, appointments: 0, visits: 0 },
  required_target_profile: target === "DOCTOR" ? "doctor_profile" : "staff_profile",
  allowed: true,
  blockers: [],
  consequences: ["The role and matching professional profile will be changed atomically."],
  confirmation_token: `token-${target}`,
});

function LocationProbe() { return <output data-testid="location">{useLocation().pathname}</output>; }
function makeClient() { return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }); }
function renderList(client = makeClient()) {
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={["/admin/users"]}><Routes><Route path="/admin/users" element={<><AdminUserListPage /><LocationProbe /></>} /><Route path="/admin/users/:userId" element={<LocationProbe />} /></Routes></MemoryRouter></QueryClientProvider>);
}
function renderDetail(user: UserManagementRecord = baseAccount, client = makeClient()) {
  vi.spyOn(usersApi, "detail").mockResolvedValue(user);
  if (user.team_member_id) vi.spyOn(teamApi, "detail").mockResolvedValue(doctorMember);
  const view = render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[`/admin/users/${user.id}`]}><Routes><Route path="/admin/users/:userId" element={<AdminUserDetailPage />} /></Routes></MemoryRouter></QueryClientProvider>);
  return { ...view, client };
}

describe("Users & Access pages", () => {
  beforeEach(() => useAuthStore.setState({ role: "ADMIN", user: { id: 1, full_name: "Admin", email: "admin@example.test", role: "ADMIN", is_active: true, must_change_password: false, password_changed_at: null, theme_preference: "LIGHT", language_preference: "EN" } }));
  afterEach(() => vi.restoreAllMocks());

  it("keeps list search, role, and login filters and opens the exact whole row", async () => {
    vi.spyOn(usersApi, "list").mockImplementation(async (query) => query?.search
      ? { count: 1, next: null, previous: null, results: [doctorAccount] }
      : { count: 2, next: null, previous: null, results: [baseAccount, doctorAccount] });
    renderList();
    expect(await screen.findByText("Dr Noor")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "Noor" } });
    expect(screen.queryByText("Amina Admin")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Role"), { target: { value: "DOCTOR" } });
    fireEvent.change(screen.getByLabelText("Login status"), { target: { value: "ACTIVE" } });
    fireEvent.click(await screen.findByRole("row", { name: /Dr Noor/ }));
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/admin/users/7"));
  });

  it("offers only Admin account creation and sends ADMIN", async () => {
    const create = vi.spyOn(usersApi, "create").mockResolvedValue(baseAccount);
    const client = makeClient();
    render(<QueryClientProvider client={client}><MemoryRouter><AdminNewUserPage /></MemoryRouter></QueryClientProvider>);
    expect(screen.queryByRole("option", { name: "Doctor" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "New Admin" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "new@example.test" } });
    fireEvent.change(screen.getByLabelText("Temporary password"), { target: { value: "StrongPassword!1" } });
    fireEvent.click(screen.getByRole("button", { name: "Create Admin account" }));
    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create.mock.calls[0]?.[0]).toEqual({ full_name: "New Admin", email: "new@example.test", temporary_password: "StrongPassword!1", role: "ADMIN" });
  });

  it("shows compact saved account state and does not let an unsaved target alter Effective Access", async () => {
    const preview = vi.spyOn(teamApi, "previewRoleTransition");
    renderDetail(doctorAccount);
    expect(await screen.findByRole("heading", { name: "Dr Noor" })).toBeInTheDocument();
    expect(screen.getByText("noor@example.test").closest("p")).toHaveAttribute("dir", "ltr");
    expect(screen.getAllByLabelText("Status: Active").length).toBeGreaterThan(0);
    const access = screen.getByRole("heading", { name: "Effective Access" }).closest("section")!;
    expect(within(access).getAllByText("Own records").length).toBeGreaterThan(0);
    expect(access.querySelector("[data-saved-role]")).toHaveAttribute("data-saved-role", "DOCTOR");
    fireEvent.change(screen.getByLabelText("New role"), { target: { value: "STAFF" } });
    expect(access.querySelector("[data-saved-role]")).toHaveAttribute("data-saved-role", "DOCTOR");
    expect(preview).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: "Review role change" })).not.toBeInTheDocument();
  });

  it("keeps Account Identity controlled and submits only on Save account", async () => {
    const update = vi.spyOn(usersApi, "update").mockResolvedValue({ ...baseAccount, full_name: "Amina Updated" });
    renderDetail();
    const name = await screen.findByLabelText("Full name");
    fireEvent.change(name, { target: { value: "Amina Updated" } });
    fireEvent.blur(name);
    expect(update).not.toHaveBeenCalled();
    expect(name).toHaveValue("Amina Updated");
    fireEvent.click(screen.getByRole("button", { name: "Save account" }));
    await waitFor(() => expect(update).toHaveBeenCalledWith(4, { full_name: "Amina Updated", email: "amina@example.test" }));
    expect(await screen.findByText("Account identity saved.")).toBeInTheDocument();
  });

  it("runs preview first, reviews consequences and Doctor requirements, then confirms with token, version, and profile", async () => {
    const preview = vi.spyOn(teamApi, "previewRoleTransition").mockResolvedValue(allowedPreview("DOCTOR"));
    const confirm = vi.spyOn(teamApi, "confirmRoleTransition").mockResolvedValue({ ...baseAccount, role: "DOCTOR", version: 8, linked_profile_state: "DOCTOR", team_member_id: 4 });
    const client = makeClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    renderDetail(baseAccount, client);
    await screen.findByRole("heading", { name: "Amina Admin" });
    fireEvent.change(screen.getByLabelText("New role"), { target: { value: "DOCTOR" } });
    expect(confirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Save role change" }));
    await waitFor(() => expect(preview).toHaveBeenCalledWith(4, "DOCTOR"));
    const dialog = await screen.findByRole("dialog", { name: "Review role change" });
    expect(within(dialog).getByText(/changed atomically/)).toBeInTheDocument();
    expect(within(dialog).getByRole("heading", { name: "Operational history" })).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Specialty")).toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Position")).not.toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText("Specialty"), { target: { value: "General" } });
    fireEvent.change(within(dialog).getByLabelText("Phone"), { target: { value: "123" } });
    fireEvent.change(within(dialog).getByText("Bio").closest("label")!.querySelector("textarea")!, { target: { value: "Profile" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirm role change" }));
    await waitFor(() => expect(confirm).toHaveBeenCalledWith(4, { target_role: "DOCTOR", mode: "CONFIRM", confirmation_token: "token-DOCTOR", version: 7, profile: { specialty: "General", phone: "123", bio: "Profile" } }));
    await waitFor(() => {
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ["users"] });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: teamQueryKeys.all });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ["user", 4] });
    });
  });

  it("shows only Staff profile fields and invalidates an old review when the target changes", async () => {
    vi.spyOn(teamApi, "previewRoleTransition").mockResolvedValue(allowedPreview("STAFF"));
    const confirm = vi.spyOn(teamApi, "confirmRoleTransition");
    renderDetail();
    await screen.findByRole("heading", { name: "Amina Admin" });
    fireEvent.change(screen.getByLabelText("New role"), { target: { value: "STAFF" } });
    fireEvent.click(screen.getByRole("button", { name: "Save role change" }));
    const dialog = await screen.findByRole("dialog", { name: "Review role change" });
    expect(within(dialog).getByLabelText("Position")).toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Specialty")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("New role"), { target: { value: "DOCTOR" } });
    expect(screen.queryByRole("dialog", { name: "Review role change" })).not.toBeInTheDocument();
    expect(confirm).not.toHaveBeenCalled();
  });

  it("shows blockers without a confirm action and Cancel never saves", async () => {
    const blocked: RoleTransitionPreview = { ...allowedPreview("STAFF"), allowed: false, blockers: [{ code: "ROLE_TRANSITION_BLOCKED_BY_HISTORY", counts: { appointments: 2 } }], confirmation_token: null, consequences: ["Operational history is retained and cannot be detached from this account."] };
    vi.spyOn(teamApi, "previewRoleTransition").mockResolvedValue(blocked);
    const confirm = vi.spyOn(teamApi, "confirmRoleTransition");
    renderDetail();
    await screen.findByRole("heading", { name: "Amina Admin" });
    fireEvent.change(screen.getByLabelText("New role"), { target: { value: "STAFF" } });
    fireEvent.click(screen.getByRole("button", { name: "Save role change" }));
    const dialog = await screen.findByRole("dialog", { name: "Review role change" });
    expect(within(dialog).getAllByText(/retained and cannot be detached/).length).toBeGreaterThan(0);
    expect(within(dialog).queryByRole("button", { name: "Confirm role change" })).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog", { name: "Review role change" })).not.toBeInTheDocument();
    expect(confirm).not.toHaveBeenCalled();
  });

  it("retains reset-password and confirmed login-state controls", async () => {
    const reset = vi.spyOn(usersApi, "resetPassword").mockResolvedValue({ ...baseAccount, must_change_password: true });
    const deactivate = vi.spyOn(usersApi, "deactivate").mockResolvedValue({ ...baseAccount, is_active: false });
    renderDetail();
    await screen.findByRole("heading", { name: "Security & Login" });
    fireEvent.click(screen.getByRole("button", { name: "Reset temporary password" }));
    const resetDialog = screen.getByRole("dialog", { name: "Reset temporary password" });
    fireEvent.change(within(resetDialog).getByLabelText("Temporary password"), { target: { value: "NewPassword!1" } });
    fireEvent.click(within(resetDialog).getByRole("button", { name: "Reset temporary password" }));
    await waitFor(() => expect(reset).toHaveBeenCalledWith(4, { temporary_password: "NewPassword!1" }));
    fireEvent.click(screen.getByRole("button", { name: "Deactivate account" }));
    const accessDialog = screen.getByRole("dialog", { name: "Deactivate account" });
    expect(deactivate).not.toHaveBeenCalled();
    fireEvent.click(within(accessDialog).getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(deactivate).toHaveBeenCalledWith(4));
  });

  it("opens the exact linked Team profile and keeps compact account metadata visible", async () => {
    renderDetail(doctorAccount);
    expect(await screen.findByText(/General Dentistry/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Team profile" })).toHaveAttribute("href", "/admin/team/7");
    const metadata = screen.getByRole("heading", { name: "Account metadata" }).closest("section")!;
    expect(within(metadata).getByText("Created")).toBeInTheDocument();
    expect(within(metadata).getByText("Updated")).toBeInTheDocument();
    expect(within(metadata).getByText("Account version")).toBeInTheDocument();
  });

  it("renders localized Arabic Users & Access headings", async () => {
    useAuthStore.setState((state) => ({ user: { ...state.user!, language_preference: "AR" } }));
    vi.spyOn(usersApi, "list").mockResolvedValue({ count: 0, next: null, previous: null, results: [] });
    renderList();
    expect(await screen.findByText("المستخدمون والصلاحيات")).toBeInTheDocument();
  });
});
