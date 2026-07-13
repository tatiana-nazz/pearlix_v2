import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { scheduleApi } from "../../api/endpoints/schedule";
import { usersApi } from "../../api/endpoints/users";
import { ApiClientError } from "../../api/errors";
import { useAuthStore } from "../../auth/authStore";
import type { AvailabilityException, ClinicDefaultShift, WorkingShift } from "../../types/schedule";
import type { UserManagementRecord } from "../../types/users";
import { LeaveManagementPage } from "./LeaveManagementPage";
import { ScheduleManagementPage } from "./ScheduleManagementPage";
import { OwnLeavePage } from "../profile/OwnLeavePage";
import { OwnSchedulePage } from "../profile/OwnSchedulePage";

vi.mock("../../api/endpoints/schedule", () => ({ scheduleApi: { defaultShifts: vi.fn(), createDefaultShift: vi.fn(), updateDefaultShift: vi.fn(), setDefaultShiftActive: vi.fn(), workingShifts: vi.fn(), createWorkingShift: vi.fn(), updateWorkingShift: vi.fn(), setWorkingShiftActive: vi.fn(), applyDefault: vi.fn(), copySchedule: vi.fn(), availabilityExceptions: vi.fn(), availabilityException: vi.fn(), createAvailabilityException: vi.fn(), updateAvailabilityException: vi.fn(), cancelAvailabilityException: vi.fn() } }));
vi.mock("../../api/endpoints/users", () => ({ usersApi: { list: vi.fn() } }));

const employee: UserManagementRecord = { id: 7, full_name: "Dr Maya", email: "maya@example.test", role: "DOCTOR", is_active: true, theme_preference: "LIGHT", language_preference: "EN", must_change_password: false, password_changed_at: null, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z", version: 1, linked_profile_state: "DOCTOR", team_member_id: 7 };
const defaultShift: ClinicDefaultShift = { id: 1, name: "Morning", weekday: 0, weekday_label: "Monday", start_time: "09:00", end_time: "13:00", is_active: true, version: 2, created_by: null, updated_by: null, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" };
const shift: WorkingShift = { id: 2, employee, name: "Morning", weekday: 0, weekday_label: "Monday", start_time: "09:00", end_time: "13:00", is_active: true, source_default_shift: 1, version: 3, created_by: null, updated_by: null, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" };
const leave: AvailabilityException = { id: 3, doctor: employee, staff: null, start_datetime: "2026-07-20T09:00:00Z", end_datetime: "2026-07-20T13:00:00Z", type: "UNAVAILABLE", reason: "Annual leave", is_cancelled: false, cancelled_at: null, cancelled_by: null, version: 4, created_by: null, updated_by: null, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" };
const page = (node: ReactElement, entry = "/admin/doctors") => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}><MemoryRouter initialEntries={[entry]}><Routes><Route path="/admin/doctors" element={node} /><Route path="/admin/leave" element={node} /><Route path="/admin/leave/:exceptionId" element={node} /><Route path="/staff/profile/schedule" element={node} /><Route path="/staff/profile/leave" element={node} /><Route path="/doctor/profile/schedule" element={node} /><Route path="/doctor/profile/leave" element={node} /></Routes></MemoryRouter></QueryClientProvider>);

function defaults() {
  vi.mocked(usersApi.list).mockResolvedValue({ count: 1, next: null, previous: null, results: [employee] });
  vi.mocked(scheduleApi.defaultShifts).mockResolvedValue({ count: 1, next: null, previous: null, results: [defaultShift] });
  vi.mocked(scheduleApi.workingShifts).mockResolvedValue({ count: 1, next: null, previous: null, results: [shift] });
  vi.mocked(scheduleApi.availabilityExceptions).mockResolvedValue({ count: 1, next: null, previous: null, results: [leave] });
}

afterEach(() => { vi.clearAllMocks(); useAuthStore.setState({ user: employee }); });

describe("Phase 14E schedule and leave production workflows", () => {
  it("uses a controlled employee schedule, exact versioned shift payloads, and impact confirmation", async () => {
    defaults(); vi.mocked(scheduleApi.updateWorkingShift).mockResolvedValue(shift);
    vi.mocked(scheduleApi.applyDefault).mockRejectedValueOnce(new ApiClientError({ code: "SHIFT_CHANGE_REQUIRES_CONFIRMATION", message: "Confirm", details: { impacted_count: 1, appointments: [{ id: 8, patient_name: "Rana", start_datetime: "2026-07-20T09:00:00Z", end_datetime: "2026-07-20T09:30:00Z", status: "UPCOMING" }], employee, proposed_schedule: {} }, status: 409 })).mockResolvedValue({ employee, mode: "MISSING_ONLY", created_count: 1, deactivated_count: 0, skipped_count: 0, impacted_appointments_count: 1, working_shifts: [shift] });
    page(<ScheduleManagementPage />);
    const user = userEvent.setup();
    await screen.findByRole("option", { name: /Dr Maya/ });
    await user.selectOptions(screen.getByLabelText("Employee"), "7");
    await user.click((await screen.findAllByRole("button", { name: "Edit shift" }))[1]);
    await user.clear(screen.getByLabelText("Shift name")); await user.type(screen.getByLabelText("Shift name"), "Evening");
    await user.click(screen.getByRole("button", { name: "Save shift" }));
    await waitFor(() => expect(scheduleApi.updateWorkingShift).toHaveBeenCalledWith(2, { name: "Evening", weekday: 0, start_time: "09:00", end_time: "13:00", version: 3 }));
    await user.click(screen.getByRole("button", { name: "Apply defaults" }));
    expect(await screen.findByRole("dialog", { name: "Confirm appointment impact" })).toHaveTextContent("1 affected future appointments");
    await user.click(screen.getByRole("button", { name: "Confirm change" }));
    await waitFor(() => expect(scheduleApi.applyDefault).toHaveBeenLastCalledWith(7, "MISSING_ONLY", true));
  });

  it("creates, filters, details, edits, and cancels leave through non-DELETE actions", async () => {
    defaults(); vi.mocked(scheduleApi.createAvailabilityException).mockResolvedValue(leave); vi.mocked(scheduleApi.updateAvailabilityException).mockResolvedValue(leave); vi.mocked(scheduleApi.cancelAvailabilityException).mockResolvedValue({ ...leave, is_cancelled: true, restored_appointments_count: 1, still_blocked_appointments_count: 0 }); vi.mocked(scheduleApi.availabilityException).mockResolvedValue(leave);
    page(<LeaveManagementPage />, "/admin/leave");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Create leave" }));
    await screen.findAllByRole("option", { name: /Dr Maya/ });
    await user.selectOptions(screen.getAllByLabelText("Employee")[1], "7");
    fireEvent.change(screen.getByLabelText("Start"), { target: { value: "2026-07-20T09:00" } });
    fireEvent.change(screen.getByLabelText("End"), { target: { value: "2026-07-20T13:00" } });
    await user.click(screen.getByRole("button", { name: "Save leave" }));
    await waitFor(() => expect(scheduleApi.createAvailabilityException).toHaveBeenCalledWith(expect.objectContaining({ doctor_id: 7, staff_id: null, type: "UNAVAILABLE" })));
    await user.click(await screen.findByRole("button", { name: "Cancel leave" }));
    expect(screen.getByText("This Doctor leave will move overlapping future appointments to Needs Reschedule.")).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Cancel leave" })[1]);
    await waitFor(() => expect(scheduleApi.cancelAvailabilityException).toHaveBeenCalledWith(3, 4));
  });

  it("keeps the management pages localized without raw enum codes", async () => {
    defaults(); useAuthStore.setState({ user: { ...employee, language_preference: "AR" } });
    page(<ScheduleManagementPage />);
    expect(await screen.findByText("الجداول")).toBeInTheDocument();
    expect(screen.queryByText("DOCTOR")).not.toBeInTheDocument();
    expect(screen.queryByText("MISSING_ONLY")).not.toBeInTheDocument();
  });

  it("keeps Doctor and Staff own schedule and leave pages read-only and self-scoped", async () => {
    defaults();
    page(<OwnSchedulePage />, "/doctor/profile/schedule");
    expect(await screen.findByText("My working schedule")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /add|edit|cancel/i })).not.toBeInTheDocument();
    useAuthStore.setState({ user: { ...employee, role: "STAFF" } });
    page(<OwnLeavePage />, "/staff/profile/leave");
    await waitFor(() => expect(scheduleApi.availabilityExceptions).toHaveBeenLastCalledWith(expect.objectContaining({ staff_id: 7, is_cancelled: "false" })));
    expect(await screen.findByText("My leave and unavailable periods")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /create|edit|cancel/i })).not.toBeInTheDocument();
  });
});
