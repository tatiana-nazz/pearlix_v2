import { describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({ getAppointments: vi.fn(), getAppointment: vi.fn(), getAppointmentAvailability: vi.fn() }));
vi.mock("../../../api/endpoints/appointments", () => apiMocks);

import { CALENDAR_RANGE_PAGE_LIMIT, fetchAppointmentRange } from "./useAppointments";

const appointment = (id: number, start: string) => ({ id, start_datetime: start }) as never;

describe("fetchAppointmentRange", () => {
  it("aggregates later pages, deduplicates, and sorts chronologically", async () => {
    apiMocks.getAppointments.mockResolvedValueOnce({ results: [appointment(2, "2026-07-11T10:00:00Z"), appointment(1, "2026-07-11T11:00:00Z")], next: "next", previous: null })
      .mockResolvedValueOnce({ results: [appointment(1, "2026-07-11T11:00:00Z"), appointment(3, "2026-07-10T09:00:00Z")], next: null, previous: "previous" });

    await expect(fetchAppointmentRange({ status: "UPCOMING", start_from: "2026-07-10T00:00:00", start_to: "2026-07-12T00:00:00" })).resolves.toEqual([
      appointment(3, "2026-07-10T09:00:00Z"), appointment(2, "2026-07-11T10:00:00Z"), appointment(1, "2026-07-11T11:00:00Z"),
    ]);
    expect(apiMocks.getAppointments).toHaveBeenNthCalledWith(2, expect.objectContaining({ page: 2, status: "UPCOMING" }));
  });

  it("fails rather than presenting an incomplete range when pagination exceeds its bound", async () => {
    apiMocks.getAppointments.mockResolvedValue({ results: [], next: "next", previous: null });
    await expect(fetchAppointmentRange({}, 1)).rejects.toThrow("safe page limit");
    expect(CALENDAR_RANGE_PAGE_LIMIT).toBeGreaterThan(1);
  });
});
