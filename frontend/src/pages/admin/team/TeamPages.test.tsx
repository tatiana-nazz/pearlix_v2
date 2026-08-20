import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { teamApi } from "../../../api/endpoints/team";
import { useAuthStore } from "../../../auth/authStore";
import type { TeamMemberDetail, TeamMemberSummary } from "../../../types/team";
import { TeamDetailPage, TeamListPage } from "./TeamPages";

const member: TeamMemberSummary = {
  id: 7,
  role: "DOCTOR",
  full_name: "Dr Noor",
  email: "noor@example.test",
  professional_status: "ACTIVE",
  specialty: "General",
  position: null,
  phone: "+9631",
  account: { id: 17, email: "noor@example.test", is_active: true, must_change_password: false, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-02T00:00:00Z" },
  availability: { availability: "AVAILABLE", on_leave: false, next_exception: null },
  today_workload: { appointment_count: 2, active_visit_count: 1 },
  schedule_summary: [{ name: "Morning", weekday: 1, start_time: "08:00:00", end_time: "13:00:00" }],
  version: 3,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-02T00:00:00Z",
};
const doctorDetail: TeamMemberDetail = {
  ...member,
  profile: { specialty: "General", phone: "+9631", bio: "Calm clinician", is_active: true },
  active_shifts: [{ id: 2, name: "Morning", weekday: 1, start_time: "08:00:00", end_time: "13:00:00", is_active: true, version: 1 }],
  current_future_leave: [{ id: 4, start_datetime: "2026-09-01T08:00:00Z", end_datetime: "2026-09-01T12:00:00Z", type: "UNAVAILABLE", reason: "Conference", is_cancelled: false, version: 1 }],
};
const staffDetail: TeamMemberDetail = {
  ...member,
  id: 8,
  role: "STAFF",
  full_name: "Maya Staff",
  email: "maya@example.test",
  specialty: null,
  position: "Reception lead",
  account: { ...member.account!, id: 18, email: "maya@example.test" },
  today_workload: { appointment_count: 0, active_visit_count: 0 },
  profile: { position: "Reception lead", phone: "+9632", is_active: true },
  active_shifts: [],
  current_future_leave: [],
};
const page = (results: TeamMemberSummary[]) => ({ count: results.length, next: null, previous: null, results });

function LocationProbe() { return <output data-testid="location">{useLocation().pathname}</output>; }
function makeClient() { return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }); }
function setRole(role: "ADMIN" | "STAFF") {
  useAuthStore.setState({ role, user: { id: 1, full_name: role, email: `${role.toLowerCase()}@example.test`, role, is_active: true, must_change_password: false, password_changed_at: null, theme_preference: "LIGHT", language_preference: "EN" } });
}
function renderList() {
  const client = makeClient();
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={["/admin/team"]}><TeamListPage /><LocationProbe /></MemoryRouter></QueryClientProvider>);
}
function renderDetail(detail: TeamMemberDetail, role: "ADMIN" | "STAFF" = "ADMIN") {
  setRole(role);
  vi.spyOn(teamApi, "detail").mockResolvedValue(detail);
  const client = makeClient();
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[`${role === "ADMIN" ? "/admin" : "/staff"}/team/${detail.id}`]}><Routes><Route path="/:workspace/team/:teamMemberId" element={<TeamDetailPage />} /></Routes></MemoryRouter></QueryClientProvider>);
}

describe("Team professional directory and detail", () => {
  beforeEach(() => setRole("ADMIN"));
  afterEach(() => vi.restoreAllMocks());

  it("opens the exact Admin Team card and maps compact list filters to the API", async () => {
    const list = vi.spyOn(teamApi, "list").mockResolvedValue(page([member]));
    renderList();
    expect(await screen.findByText("Dr Noor")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "Noor" } });
    await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ q: "Noor", page: 1 })));
    fireEvent.keyDown(await screen.findByRole("link", { name: /Dr Noor/ }), { key: "Enter" });
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/admin/team/7"));
  });

  it("opens the safe exact Staff Team card without account creation", async () => {
    setRole("STAFF");
    vi.spyOn(teamApi, "list").mockResolvedValue(page([{ ...member, account: undefined, version: undefined }]));
    renderList();
    expect(await screen.findByText("Dr Noor")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Add team member/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: /Dr Noor/ }));
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/staff/team/7"));
  });

  it("defaults Admin Team detail to readable professional, contact, workload, schedule, and leave sections", async () => {
    renderDetail(doctorDetail);
    expect(await screen.findByRole("heading", { name: "Dr Noor" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Professional information" })).toBeInTheDocument();
    expect(screen.getByText("Calm clinician")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Contact" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Today's workload" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Schedule" })).toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: "Shift 1" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Leave / availability" })).toBeInTheDocument();
    expect(screen.getByText("Conference")).toBeInTheDocument();
    expect(screen.queryByLabelText("Specialty")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit professional profile" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Users & Access" })).toHaveAttribute("href", "/admin/users/17");
    expect(screen.queryByText(/Target role|Role & Access Change/)).not.toBeInTheDocument();
  });

  it("keeps Staff Team detail read-only with no edit, status mutation, or Users & Access controls", async () => {
    renderDetail({ ...doctorDetail, account: undefined, version: undefined }, "STAFF");
    expect(await screen.findByRole("heading", { name: "Dr Noor" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Professional information" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Schedule" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit professional profile" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /professional profile/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open Users & Access" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Password|New role|Role & Access/)).not.toBeInTheDocument();
  });

  it("uses a controlled Doctor edit mode and Cancel restores server values without saving", async () => {
    const update = vi.spyOn(teamApi, "update");
    renderDetail(doctorDetail);
    fireEvent.click(await screen.findByRole("button", { name: "Edit professional profile" }));
    const specialty = screen.getByLabelText("Specialty");
    expect(specialty).toHaveValue("General");
    fireEvent.change(specialty, { target: { value: "Orthodontics" } });
    expect(specialty).toHaveValue("Orthodontics");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(update).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Specialty")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit professional profile" }));
    expect(screen.getByLabelText("Specialty")).toHaveValue("General");
  });

  it("saves only Doctor professional fields with version and returns to updated read mode", async () => {
    const detail = vi.spyOn(teamApi, "detail").mockResolvedValueOnce(doctorDetail).mockResolvedValue({ ...doctorDetail, specialty: "Orthodontics", profile: { ...doctorDetail.profile, specialty: "Orthodontics" } });
    const update = vi.spyOn(teamApi, "update").mockResolvedValue({ ...member, specialty: "Orthodontics", version: 4 });
    const client = makeClient();
    render(<QueryClientProvider client={client}><MemoryRouter initialEntries={["/admin/team/7"]}><Routes><Route path="/admin/team/:teamMemberId" element={<TeamDetailPage />} /></Routes></MemoryRouter></QueryClientProvider>);
    fireEvent.click(await screen.findByRole("button", { name: "Edit professional profile" }));
    fireEvent.change(screen.getByLabelText("Specialty"), { target: { value: "Orthodontics" } });
    fireEvent.change(screen.getByLabelText("Phone"), { target: { value: "+9639" } });
    fireEvent.change(screen.getByText("Bio").closest("label")!.querySelector("textarea")!, { target: { value: "Updated bio" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(update).toHaveBeenCalledWith(7, { specialty: "Orthodontics", phone: "+9639", bio: "Updated bio", version: 3 }));
    await waitFor(() => expect(screen.queryByLabelText("Specialty")).not.toBeInTheDocument());
    expect(await screen.findByText("Orthodontics")).toBeInTheDocument();
    expect(screen.getByText("Professional profile saved.")).toBeInTheDocument();
    expect(detail).toHaveBeenCalled();
  });

  it("saves only Staff professional fields with version and returns to read mode", async () => {
    vi.spyOn(teamApi, "detail").mockResolvedValueOnce(staffDetail).mockResolvedValue({ ...staffDetail, position: "Operations lead", profile: { ...staffDetail.profile, position: "Operations lead" } });
    const update = vi.spyOn(teamApi, "update").mockResolvedValue({ ...staffDetail, position: "Operations lead", version: 4 });
    const client = makeClient();
    render(<QueryClientProvider client={client}><MemoryRouter initialEntries={["/admin/team/8"]}><Routes><Route path="/admin/team/:teamMemberId" element={<TeamDetailPage />} /></Routes></MemoryRouter></QueryClientProvider>);
    fireEvent.click(await screen.findByRole("button", { name: "Edit professional profile" }));
    expect(screen.queryByLabelText("Specialty")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Position"), { target: { value: "Operations lead" } });
    fireEvent.change(screen.getByLabelText("Phone"), { target: { value: "+9638" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(update).toHaveBeenCalledWith(8, { position: "Operations lead", phone: "+9638", version: 3 }));
    await waitFor(() => expect(screen.queryByLabelText("Position")).not.toBeInTheDocument());
    expect(await screen.findByText("Operations lead")).toBeInTheDocument();
  });

  it("keeps professional-status mutation Admin-only and behind confirmation", async () => {
    const status = vi.spyOn(teamApi, "setProfessionalStatus").mockResolvedValue({ ...member, professional_status: "INACTIVE", version: 4 });
    renderDetail(doctorDetail);
    fireEvent.click(await screen.findByRole("button", { name: "Deactivate professional profile" }));
    const dialog = screen.getByRole("dialog", { name: "Confirm professional status" });
    expect(status).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(status).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Deactivate professional profile" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Confirm professional status" })).getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(status).toHaveBeenCalledWith(7, { is_active: false, version: 3 }));
  });

  it("renders Arabic Team copy", async () => {
    useAuthStore.setState((state) => ({ user: { ...state.user!, language_preference: "AR" } }));
    vi.spyOn(teamApi, "list").mockResolvedValue(page([]));
    renderList();
    expect(await screen.findByRole("heading", { name: /الفريق/ })).toBeInTheDocument();
  });
});
