import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { BackLink } from "./BackLink";

describe("BackLink", () => {
  it("renders a semantic link with a decorative back arrow", () => {
    render(<MemoryRouter><BackLink to="/patients">Back to Patients</BackLink></MemoryRouter>);

    expect(screen.getByRole("link", { name: "Back to Patients" })).toHaveAttribute("href", "/patients");
    expect(screen.getByText("←")).toHaveAttribute("aria-hidden", "true");
  });
});
