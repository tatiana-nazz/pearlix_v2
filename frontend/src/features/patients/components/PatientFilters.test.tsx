import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PatientFilters } from "./PatientFilters";

const handlers = {
  onSearchChange: vi.fn(),
  onArchiveFilterChange: vi.fn(),
  onDoctorFilterChange: vi.fn(),
};

describe("PatientFilters", () => {
  it("shows archived filter for Staff", () => {
    render(<PatientFilters role="STAFF" search="" archiveFilter="active" doctorFilter="all" {...handlers} />);
    expect(screen.getByLabelText("Archive state")).toBeInTheDocument();
  });

  it("does not show archived filter for Doctor", () => {
    render(<PatientFilters role="DOCTOR" search="" archiveFilter="active" doctorFilter="all" {...handlers} />);
    expect(screen.queryByLabelText("Archive state")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Patient scope")).toBeInTheDocument();
  });
});
