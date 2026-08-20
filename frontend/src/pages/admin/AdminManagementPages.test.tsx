import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PropsWithChildren } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { auditApi } from "../../api/endpoints/audit";
import { clinicApi } from "../../api/endpoints/clinic";
import { ApiClientError } from "../../api/errors";
import { useAuthStore } from "../../auth/authStore";
import type { AuditLog } from "../../types/audit";
import type { ClinicSettings } from "../../types/clinic";
import { AdminAuditLogDetailPage, AdminAuditLogListPage, AdminClinicSettingsPage } from "./AdminManagementPages";

vi.mock("../../api/endpoints/audit", () => ({
  auditApi: {
    list: vi.fn(),
    detail: vi.fn(),
  },
}));

vi.mock("../../api/endpoints/clinic", () => ({
  clinicSettingsQueryKey: ["clinic-settings"],
  clinicApi: {
    getSettings: vi.fn(),
    updateSettings: vi.fn(),
  },
}));

const clinicSettings: ClinicSettings = {
  clinic_name: "Pearlix",
  address: "Damascus",
  phone: "+963111111",
  email: "clinic@example.test",
  timezone: "Asia/Damascus",
  capacity_per_slot: 2,
  default_appointment_duration_minutes: 30,
  allowed_durations_minutes: [30, 60],
  default_currency: "SYP",
  supported_currencies: ["SYP", "USD"],
  default_language: "EN",
  weekly_closed_days: [4],
  ai_mode: "MOCK_ADAPTER",
  ai_service_url: "http://127.0.0.1:9000",
};

const auditRecord: AuditLog = {
  id: 42,
  actor: {
    id: 7,
    email: "admin@example.test",
    full_name: "Pearlix Admin",
    role: "ADMIN",
    is_active: true,
    theme_preference: "LIGHT",
    language_preference: "EN",
  },
  actor_role: "ADMIN",
  action: "USER_UPDATED",
  entity_type: "User",
  entity_id: "17",
  metadata_json: {
    changed: ["full_name"],
    password: "must-not-render",
    nested: { access_token: "also-secret" },
  },
  ip_address: "127.0.0.1",
  created_at: "2026-08-08T09:30:00Z",
};

function TestProviders({ children }: PropsWithChildren) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("Admin audit logs", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("renders detail from the route ID without an invalid hook call and redacts sensitive metadata", async () => {
    vi.mocked(auditApi.detail).mockResolvedValue(auditRecord);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(
      <TestProviders>
        <MemoryRouter initialEntries={["/admin/audit-logs/42"]}>
          <Routes><Route path="/admin/audit-logs/:auditLogId" element={<AdminAuditLogDetailPage />} /></Routes>
        </MemoryRouter>
      </TestProviders>,
    );

    expect(await screen.findByRole("heading", { name: "Audit Record" })).toBeInTheDocument();
    await waitFor(() => expect(auditApi.detail).toHaveBeenCalledWith(42));
    expect(screen.getByText("USER_UPDATED")).toBeInTheDocument();
    expect(screen.getByLabelText("Audit metadata")).toHaveTextContent("[redacted]");
    expect(screen.getByLabelText("Audit metadata")).not.toHaveTextContent("must-not-render");
    expect(screen.getByLabelText("Audit metadata")).not.toHaveTextContent("also-secret");
    expect(consoleError.mock.calls.flat().join(" ")).not.toContain("Invalid hook call");
  });

  it("requests the paginated list and opens the exact record with keyboard activation", async () => {
    vi.mocked(auditApi.list).mockResolvedValue({ count: 1, next: null, previous: null, results: [auditRecord] });

    render(
      <TestProviders>
        <MemoryRouter initialEntries={["/admin/audit-logs"]}>
          <Routes>
            <Route path="/admin/audit-logs" element={<AdminAuditLogListPage />} />
            <Route path="/admin/audit-logs/:auditLogId" element={<p>Opened exact audit record</p>} />
          </Routes>
        </MemoryRouter>
      </TestProviders>,
    );

    expect(await screen.findByRole("table", { name: "Audit records" })).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader").map((header) => header.textContent)).toEqual(["Time", "Actor", "Action", "Entity"]);
    expect(auditApi.list).toHaveBeenCalledWith({ page: 1 });
    fireEvent.keyDown(screen.getByRole("row", { name: "Open audit record 42" }), { key: "Enter" });
    expect(await screen.findByText("Opened exact audit record")).toBeInTheDocument();
  });
});

describe("Admin clinic operating week", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      role: "ADMIN",
      user: {
        id: 1,
        email: "admin@example.test",
        full_name: "Admin",
        role: "ADMIN",
        is_active: true,
        must_change_password: false,
        password_changed_at: null,
        theme_preference: "LIGHT",
        language_preference: "EN",
      },
    });
    vi.mocked(clinicApi.getSettings).mockResolvedValue(clinicSettings);
    vi.mocked(clinicApi.updateSettings).mockResolvedValue({
      ...clinicSettings,
      affected_appointments_count: 0,
      restored_appointments_count: 0,
      still_blocked_appointments_count: 0,
    });
  });

  it("saves a deterministic multi-day selection with accessible selected states", async () => {
    render(<TestProviders><AdminClinicSettingsPage /></TestProviders>);

    expect(await screen.findByRole("group", { name: "Weekly clinic days off" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Friday" })).toBeChecked();
    await userEvent.click(screen.getByRole("checkbox", { name: "Sunday" }));
    await userEvent.click(screen.getByRole("button", { name: "Save settings" }));

    await waitFor(() => expect(clinicApi.updateSettings).toHaveBeenCalledWith(expect.objectContaining({
      weekly_closed_days: [4, 6],
      confirm_appointment_impact: false,
    })));
  });

  it("blocks an all-seven selection locally with a visible validation error", async () => {
    render(<TestProviders><AdminClinicSettingsPage /></TestProviders>);
    await screen.findByRole("group", { name: "Weekly clinic days off" });

    for (const day of ["Monday", "Tuesday", "Wednesday", "Thursday", "Saturday", "Sunday"]) {
      await userEvent.click(screen.getByRole("checkbox", { name: day }));
    }

    expect(screen.getByRole("alert")).toHaveTextContent("cannot be closed on all seven weekdays");
    expect(screen.getByRole("button", { name: "Save settings" })).toBeDisabled();
    expect(clinicApi.updateSettings).not.toHaveBeenCalled();
  });

  it("requires explicit confirmation before applying appointment impact", async () => {
    vi.mocked(clinicApi.updateSettings)
      .mockRejectedValueOnce(new ApiClientError({
        code: "CLINIC_CLOSURE_REQUIRES_CONFIRMATION",
        message: "Confirmation required.",
        status: 409,
        details: {
          impacted_count: 1,
          proposed_weekly_closed_days: [4, 6],
          appointments: [{ id: 9, patient_name: "Maya Patient", start_datetime: "2026-08-23T09:00:00Z", end_datetime: "2026-08-23T09:30:00Z", status: "UPCOMING" }],
        },
      }))
      .mockResolvedValueOnce({ ...clinicSettings, weekly_closed_days: [4, 6], affected_appointments_count: 1, restored_appointments_count: 0, still_blocked_appointments_count: 0 });
    render(<TestProviders><AdminClinicSettingsPage /></TestProviders>);

    await screen.findByRole("group", { name: "Weekly clinic days off" });
    await userEvent.click(screen.getByRole("checkbox", { name: "Sunday" }));
    await userEvent.click(screen.getByRole("button", { name: "Save settings" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("1 future appointment");
    expect(screen.getByText(/Maya Patient/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Confirm clinic closure" }));

    await waitFor(() => expect(clinicApi.updateSettings).toHaveBeenLastCalledWith(expect.objectContaining({
      weekly_closed_days: [4, 6],
      confirm_appointment_impact: true,
    })));
  });

  it("renders Arabic weekday controls in an RTL-compatible container", async () => {
    useAuthStore.setState((state) => ({ user: state.user ? { ...state.user, language_preference: "AR" } : null }));
    render(<div dir="rtl"><TestProviders><AdminClinicSettingsPage /></TestProviders></div>);

    expect(await screen.findByRole("group", { name: "أيام إغلاق العيادة الأسبوعية" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "الجمعة" })).toBeChecked();
    expect(screen.getByRole("group", { name: "أيام إغلاق العيادة الأسبوعية" }).closest("[dir=rtl]")).toBeInTheDocument();
  });
});
