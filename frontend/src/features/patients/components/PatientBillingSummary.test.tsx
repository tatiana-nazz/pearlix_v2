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

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText(/Completed-visit handoffs remain available/i)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
