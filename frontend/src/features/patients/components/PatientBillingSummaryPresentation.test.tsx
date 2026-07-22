import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { PatientBillingSummary } from "./PatientBillingSummary";

describe("PatientBillingSummary presentation", () => {
  it("keeps the Staff patient-specific invoice destination intact", () => {
    render(<MemoryRouter><PatientBillingSummary role="STAFF" patientId={9} /></MemoryRouter>);
    expect(screen.getByRole("link", { name: "Patient invoices" })).toHaveAttribute("href", "/staff/billing/invoices?patient_id=9");
  });

  it("does not expose payment or invoice controls in the Doctor handoff context", () => {
    render(<MemoryRouter><PatientBillingSummary role="DOCTOR" patientId={9} /></MemoryRouter>);
    expect(screen.getByRole("link", { name: "My billing handoffs" })).toHaveAttribute("href", "/doctor/billing/handoffs");
    expect(screen.queryByRole("button", { name: /payment|invoice/i })).not.toBeInTheDocument();
  });
});
