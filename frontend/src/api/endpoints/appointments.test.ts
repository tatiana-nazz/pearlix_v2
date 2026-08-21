import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AppointmentList } from "../../types/appointments";

const mocks = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("../http", () => ({ api: { get: mocks.get } }));

import { getAllAppointments } from "./appointments";

function row(id: number) {
  return { id } as AppointmentList;
}

describe("getAllAppointments", () => {
  beforeEach(() => vi.clearAllMocks());

  it("follows every DRF page for a bounded calendar period", async () => {
    mocks.get
      .mockResolvedValueOnce({
        count: 3,
        next: "http://example.test/api/appointments/?page=2",
        previous: null,
        results: [row(1), row(2)],
        clinic_date: "2026-08-20",
        clinic_timezone: "Asia/Damascus",
      })
      .mockResolvedValueOnce({
        count: 3,
        next: null,
        previous: "http://example.test/api/appointments/?page=1",
        results: [row(3)],
        clinic_date: "2026-08-20",
        clinic_timezone: "Asia/Damascus",
      });

    const result = await getAllAppointments({
      page: 9,
      start_from: "2026-08-01T00:00:00",
      start_to: "2026-09-01T00:00:00",
    });

    expect(mocks.get).toHaveBeenCalledTimes(2);
    expect(mocks.get.mock.calls.map((call) => call[1]?.page)).toEqual([1, 2]);
    expect(result.results.map((appointment) => appointment.id)).toEqual([1, 2, 3]);
    expect(result.count).toBe(3);
    expect(result.next).toBeNull();
    expect(result.previous).toBeNull();
  });
});
