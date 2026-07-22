import userEvent from "@testing-library/user-event";
import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "../../auth/authStore";

const dashboard = {
  today_own_appointments: [{ id: 21 }],
  own_checked_in_appointments: [{ id: 22 }],
  own_needs_reschedule_appointments: [],
  own_active_visit: null,
  own_completed_visits_today_count: 3,
  own_recent_visits: [],
  own_pending_billing_handoffs: [],
  own_working_schedule: [],
  own_availability_exceptions: [],
};

const appointment = {
  id: 21,
  patient: { id: 4, full_name: "Maya Patient", phone_number: "555-0104", email: "maya@example.test", is_archived: false },
  doctor: { id: 2, full_name: "Dr Noor", email: "noor@example.test", role: "DOCTOR", is_active: true },
  start_datetime: "2026-07-19T09:00:00Z",
  end_datetime: "2026-07-19T09:30:00Z",
  duration_minutes: 30,
  reason: "Review",
  status: "UPCOMING" as const,
  reschedule_source_exception: null,
  reschedule_source_working_shift: null,
  reschedule_source_type: null,
  reschedule_source_label: null,
  created_at: "2026-07-19T08:00:00Z",
  updated_at: "2026-07-19T08:00:00Z",
};

vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: { queryKey: string[] }) => {
    if (queryKey[0] === "dashboard") return { isLoading: false, isError: false, data: dashboard, refetch: vi.fn() };
    if (queryKey[0] === "clinic-settings") return { isLoading: false, isError: false, data: { timezone: "UTC" } };
    return { isLoading: false, isError: false, data: { count: 1, next: null, previous: null, results: [appointment] }, refetch: vi.fn() };
  },
}));

import { DoctorDashboardPage } from "./DoctorDashboardPage";

function renderDashboard() {
  return render(<MemoryRouter initialEntries={["/doctor/dashboard"]}><DoctorDashboardPage /></MemoryRouter>);
}

describe("Doctor dashboard composition", () => {
  afterEach(() => {
    useAuthStore.setState({ user: null, role: null });
  });

  it("renders four backend-derived clinical KPIs and the linked appointment queue without unsupported actions", async () => {
    renderDashboard();
    const cards = document.querySelectorAll(".dashboard-kpi-grid .kpi-card");
    expect(cards).toHaveLength(4);
    expect(Array.from(cards).map((card) => card.querySelector(".kpi-value")?.textContent)).toEqual(["1", "0", "3", "1"]);
    expect(screen.getByRole("heading", { name: "Clinical workspace" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "My Appointment Queue" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Maya Patient/ })).toHaveAttribute("href", expect.stringMatching(/^\/doctor\/appointments\/list\?date=\d{4}-\d{2}-\d{2}&status=UPCOMING&appointment=21$/));
    expect(screen.queryByRole("button", { name: /invoice|payment|clinic settings/i })).not.toBeInTheDocument();
  });

  it("supports every queue tab and the cancelled/no-show selector with Arabic labels", async () => {
    act(() => useAuthStore.setState({ user: { language_preference: "AR" } as never, role: "DOCTOR" }));
    const user = userEvent.setup();
    renderDashboard();
    expect(screen.getByRole("heading", { name: "مساحة العمل السريرية" })).toBeInTheDocument();
    for (const name of ["القادمة", "تم تسجيل الحضور", "نشطة", "مكتملة"]) {
      await user.click(screen.getByRole("tab", { name }));
      await waitFor(() => expect(screen.getByRole("tab", { name })).toHaveAttribute("aria-selected", "true"));
    }
    await user.click(screen.getByRole("tab", { name: "ملغاة / لم يحضر" }));
    expect(screen.getByRole("button", { name: "ملغى" })).toHaveClass("active");
    await user.click(screen.getByRole("button", { name: "لم يحضر" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "لم يحضر" })).toHaveClass("active"));
    expect(screen.getByLabelText("الحالة: قادم")).toBeInTheDocument();
  });
});
