import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "../../auth/authStore";
import { teamApi } from "../../api/endpoints/team";
import { AdminTeamListPage } from "./TeamPages";

vi.mock("../../api/endpoints/team", () => ({
  teamQueryKeys: { all: ["team-members"], detail: (id: number) => ["team-members", id] },
  teamApi: { list: vi.fn(), create: vi.fn(), update: vi.fn(), detail: vi.fn(), setProfessionalStatus: vi.fn() },
}));

const member = {
  id: 7, role: "DOCTOR" as const, full_name: "Dr Maya", professional_status: "ACTIVE" as const, specialty: "Endodontics", position: null, phone: "+963 11", account: { id: 44, email: "maya@example.test", is_active: true, must_change_password: false, created_at: "2026-01-01", updated_at: "2026-01-01" }, availability: { availability: "AVAILABLE" as const, on_leave: false, next_exception: null }, today_workload: { appointment_count: 3, active_visit_count: 0 }, version: 1, created_at: "2026-01-01", updated_at: "2026-01-01",
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={["/admin/team"]}><Routes><Route path="/admin/team" element={<AdminTeamListPage />} /></Routes></MemoryRouter></QueryClientProvider>);
}

describe("Admin Team workflow", () => {
  afterEach(() => { useAuthStore.setState({ user: { language_preference: "EN" } as never }); vi.clearAllMocks(); });

  it("renders localized professional data without raw role or status values", async () => {
    vi.mocked(teamApi.list).mockResolvedValue({ count: 1, next: null, previous: null, results: [member] });
    renderPage();
    expect(await screen.findByText("Dr Maya")).toBeInTheDocument();
    expect(screen.getAllByText("Doctors")).toHaveLength(2);
    expect(screen.getByLabelText("Status: Active")).toBeInTheDocument();
    expect(screen.queryByText("DOCTOR")).not.toBeInTheDocument();
    expect(screen.queryByText("ACTIVE")).not.toBeInTheDocument();
    expect(screen.getByText("maya@example.test")).toHaveClass("bidi-isolate");
  });

  it("opens an Arabic create form and protects changed values behind the shared discard confirmation", async () => {
    useAuthStore.setState({ user: { language_preference: "AR" } as never });
    vi.mocked(teamApi.list).mockResolvedValue({ count: 0, next: null, previous: null, results: [] });
    renderPage();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "إضافة عضو فريق" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.type(screen.getByLabelText("الاسم الكامل"), "ليلى");
    await user.click(screen.getByRole("button", { name: "إغلاق" }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "متابعة التحرير" }));
    expect(screen.getByLabelText("الاسم الكامل")).toHaveValue("ل");
  });
});
