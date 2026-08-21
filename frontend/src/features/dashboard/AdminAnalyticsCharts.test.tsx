import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { AdminAnalyticsCharts } from "./AdminAnalyticsCharts";

const outcomes = [{ date: "2026-08-08", COMPLETED: 1, CANCELLED: 0, NO_SHOW: 0, NEEDS_RESCHEDULE: 0, UPCOMING: 0, CHECKED_IN: 0, ACTIVE: 0 }];
const billing = [{ date: "2026-08-08", USD: { billed: "10", collected: "5" }, SYP: { billed: "0", collected: "0" } }];
const patientMix = [{ week_start: "2026-08-03", new: 1, returning: 0 }];
const problemRate = [{ week_start: "2026-08-03", scheduled: 1, cancelled: 0, no_show: 0, rate_percent: 0 }];
const aging = [{ bucket: "0_7" as const, USD: "0", SYP: "0" }];

describe("Phase 5 analytics presentation", () => {
  it("shows every active doctor beyond eight and exposes exact values on keyboard focus", () => {
    const utilization = Array.from({ length: 10 }, (_, index) => ({ doctor: { id: index + 1, full_name: `Doctor ${index + 1}` }, booked_minutes: (index + 1) * 10, available_minutes: 100, utilization_percent: (index + 1) * 10 }));
    render(<MemoryRouter><AdminAnalyticsCharts language="EN" outcomes={outcomes} utilization={utilization} billing={billing} patientMix={patientMix} problemRate={problemRate} aging={aging} /></MemoryRouter>);
    expect(screen.getByText("All 10 active doctors")).toBeInTheDocument();
    const tenth = screen.getByLabelText(/Doctor 10: 100.0%/);
    fireEvent.focus(tenth);
    expect(screen.getByText("100 min booked")).toBeInTheDocument();
    expect(screen.getByText(/including no-shows/)).toBeInTheDocument();
    expect(screen.getAllByRole("table", { name: /Exact chart values/ })).toHaveLength(2);
  });

  it("uses explicit empty states while preserving zero-value charts as data", () => {
    const { rerender } = render(<MemoryRouter><AdminAnalyticsCharts language="EN" outcomes={[]} utilization={[]} billing={[]} patientMix={[]} problemRate={[]} aging={[]} /></MemoryRouter>);
    expect(screen.getAllByText("No analytics data is available for this period.")).toHaveLength(6);
    rerender(<MemoryRouter><AdminAnalyticsCharts language="EN" outcomes={outcomes.map((row) => ({ ...row, COMPLETED: 0 }))} utilization={[{ doctor: { id: 1, full_name: "Doctor Zero" }, booked_minutes: 0, available_minutes: 100, utilization_percent: 0 }]} billing={billing} patientMix={patientMix} problemRate={problemRate} aging={aging} /></MemoryRouter>);
    expect(screen.getByLabelText(/Doctor Zero: 0.0%/)).toBeInTheDocument();
  });
});
