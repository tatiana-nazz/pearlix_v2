import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clinicApi } from "../../api/endpoints/clinic";
import { scheduleApi } from "../../api/endpoints/schedule";
import { usersApi } from "../../api/endpoints/users";
import { ScheduleManagementPage } from "./ScheduleManagementPage";

describe("ScheduleManagementPage clinic operating week", () => {
  beforeEach(() => {
    vi.spyOn(clinicApi, "getSettings").mockResolvedValue({ clinic_name: "Pearlix", address: "", phone: "", email: "", timezone: "Asia/Damascus", capacity_per_slot: 1, default_appointment_duration_minutes: 30, allowed_durations_minutes: [30], default_currency: "SYP", supported_currencies: ["SYP"], default_language: "EN", weekly_closed_days: [4] });
    vi.spyOn(scheduleApi, "defaultShifts").mockResolvedValue({ count: 1, next: null, previous: null, results: [{ id: 8, name: "Friday template", weekday: 4, weekday_label: "Friday", start_time: "09:00:00", end_time: "13:00:00", is_active: true, clinic_closed: true, effective_is_active: false, version: 1, created_by: null, updated_by: null, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" }] });
    vi.spyOn(usersApi, "list").mockResolvedValue({ count: 0, next: null, previous: null, results: [] });
  });
  afterEach(() => vi.restoreAllMocks());

  it("keeps the stored default shift visible but presents it as Clinic closed instead of ACTIVE", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><ScheduleManagementPage /></QueryClientProvider>);

    expect(await screen.findByText("Friday template")).toBeInTheDocument();
    expect(screen.getByText("Clinic closed · shift stored")).toBeInTheDocument();
    expect(screen.getByLabelText("Status: CLINIC CLOSED")).toBeInTheDocument();
    expect(screen.queryByLabelText("Status: ACTIVE")).not.toBeInTheDocument();
  });
});
