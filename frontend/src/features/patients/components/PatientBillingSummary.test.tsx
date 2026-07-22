import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { PatientBillingSummary } from "./PatientBillingSummary";

describe("PatientBillingSummary", () => {
  it("does not expose invoices or payments for Doctor", () => {
    render(
      <MemoryRouter>
        <PatientBillingSummary role="DOCTOR" />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "My billing handoffs" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /invoice|payment/i })).not.toBeInTheDocument();
  });
});
