import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { scheduleApi } from "../../api/endpoints/schedule";
import { usersApi } from "../../api/endpoints/users";
import { LeaveManagementPage } from "./LeaveManagementPage";

describe("LeaveManagementPage parameter route", () => {
  afterEach(() => vi.restoreAllMocks());

  it("opens the exact exception requested by /admin/leave/:exceptionId", async () => {
    vi.spyOn(usersApi, "listScheduleEmployees").mockResolvedValue({ count: 0, next: null, previous: null, results: [] });
    vi.spyOn(scheduleApi, "allAvailabilityExceptions").mockResolvedValue({ count: 2, next: null, previous: null, results: [
      { id: 41, doctor: { id: 4, full_name: "Doctor Four", email: "four@test.local", role: "DOCTOR", is_active: true, theme_preference: "SYSTEM", language_preference: "EN" }, staff: null, start_datetime: "2026-09-01T09:00:00+03:00", end_datetime: "2026-09-01T10:00:00+03:00", type: "UNAVAILABLE", reason: "First", is_cancelled: false, cancelled_at: null, cancelled_by: null, version: 1, created_by: null, updated_by: null, created_at: "2026-08-01T00:00:00Z", updated_at: "2026-08-01T00:00:00Z" },
      { id: 42, doctor: { id: 5, full_name: "Doctor Five", email: "five@test.local", role: "DOCTOR", is_active: true, theme_preference: "SYSTEM", language_preference: "EN" }, staff: null, start_datetime: "2026-09-02T09:00:00+03:00", end_datetime: "2026-09-02T10:00:00+03:00", type: "UNAVAILABLE", reason: "Requested record", is_cancelled: false, cancelled_at: null, cancelled_by: null, version: 2, created_by: null, updated_by: null, created_at: "2026-08-01T00:00:00Z", updated_at: "2026-08-01T00:00:00Z" },
    ] });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const router = createMemoryRouter([{ path: "/admin/leave/:exceptionId", element: <QueryClientProvider client={client}><LeaveManagementPage /></QueryClientProvider> }], { initialEntries: ["/admin/leave/42"] });
    render(<RouterProvider router={router} />);
    const dialog = await screen.findByRole("dialog", { name: "Leave details" });
    expect(dialog).toHaveTextContent("Doctor Five");
    expect(dialog).toHaveTextContent("Requested record");
    expect(dialog).not.toHaveTextContent("First");
    expect(screen.getByRole("link", { name: "Back to Leave" })).toHaveAttribute("href", "/admin/leave");
  });
});
