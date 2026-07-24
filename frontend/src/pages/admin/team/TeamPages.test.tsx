import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { teamApi } from "../../../api/endpoints/team";
import { useAuthStore } from "../../../auth/authStore";
import { TeamListPage } from "./TeamPages";
import type { TeamMemberSummary } from "../../../types/team";

const page = (results: TeamMemberSummary[]) => ({ count: results.length, next: null, previous: null, results });
const member = { id: 7, role: "DOCTOR" as const, full_name: "Dr Noor", professional_status: "ACTIVE" as const, specialty: "General", position: null, phone: "1", account: { id: 7, email: "noor@example.test", is_active: true, must_change_password: false, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" }, availability: { availability: "AVAILABLE" as const, on_leave: false, next_exception: null }, today_workload: { appointment_count: 2, active_visit_count: 1 }, version: 1, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" };
function LocationProbe() { return <output data-testid="location">{useLocation().pathname}</output>; }
function renderPage() { const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); return render(<QueryClientProvider client={client}><MemoryRouter><TeamListPage /><LocationProbe /></MemoryRouter></QueryClientProvider>); }

describe("TeamListPage", () => {
  beforeEach(() => useAuthStore.setState({ user: { id: 1, full_name: "Admin", email: "admin@example.test", role: "ADMIN", is_active: true, must_change_password: false, password_changed_at: null, theme_preference: "LIGHT", language_preference: "EN" } }));
  afterEach(() => vi.restoreAllMocks());
  it("renders loaded Team rows and opens them by keyboard", async () => { vi.spyOn(teamApi, "list").mockResolvedValue(page([member])); renderPage(); expect(await screen.findByText("Dr Noor")).toBeInTheDocument(); fireEvent.keyDown(screen.getByText("Dr Noor").closest("tr")!, { key: "Enter" }); await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/admin/team/7")); });
  it("maps filters and search to the server query", async () => { const list = vi.spyOn(teamApi, "list").mockResolvedValue(page([])); renderPage(); await screen.findByText("No team members match these filters"); fireEvent.change(screen.getByLabelText("Search"), { target: { value: "Noor" } }); await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ q: "Noor", page: 1 }))); });
  it("shows the empty state", async () => { vi.spyOn(teamApi, "list").mockResolvedValue(page([])); renderPage(); expect(await screen.findByText("No team members match these filters")).toBeInTheDocument(); });
  it("renders Arabic Team copy", async () => { useAuthStore.setState((state) => ({ user: { ...state.user!, language_preference: "AR" } })); vi.spyOn(teamApi, "list").mockResolvedValue(page([])); renderPage(); expect(await screen.findByRole("heading", { name: /أعضاء الفريق/ })).toBeInTheDocument(); });
});
