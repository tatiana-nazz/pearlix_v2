import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { navigationByRole, Sidebar } from "./Sidebar";

describe("Sidebar", () => {
  it("exposes only reachable, role-appropriate navigation targets", () => {
    const expectedPrefixes = {
      ADMIN: "/admin/",
      STAFF: "/staff/",
      DOCTOR: "/doctor/",
    } as const;

    for (const role of Object.keys(expectedPrefixes) as Array<keyof typeof expectedPrefixes>) {
      const paths = navigationByRole[role].map((item) => item.path);
      expect(new Set(paths).size).toBe(paths.length);
      expect(paths.every((path) => path.startsWith(expectedPrefixes[role]))).toBe(true);
    }

    expect(navigationByRole.STAFF.some((item) => item.path.includes("external-xrays"))).toBe(false);
    expect(navigationByRole.DOCTOR.some((item) => item.path.includes("billing/invoices"))).toBe(false);
    for (const role of ["ADMIN", "STAFF", "DOCTOR"] as const) expect(navigationByRole[role].some((item) => item.path === `/${role.toLowerCase()}/profile`)).toBe(false);
  });

  it("uses the localized simple-arrow collapse control and keeps Profile in the footer", () => {
    render(<MemoryRouter><Sidebar role="DOCTOR" /></MemoryRouter>);
    const toggle = screen.getByRole("button", { name:"Collapse sidebar" });
    expect(toggle).toHaveClass("sidebar-toggle-simple");
    expect(toggle.querySelector("svg")).toHaveClass("directional-icon");
    expect(screen.getByRole("link", { name:"My profile" })).toHaveAttribute("href", "/doctor/profile");
    expect(screen.queryByRole("link", { name:"My schedule" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name:"My leave" })).not.toBeInTheDocument();
  });

  it("renders accessible links for the current workspace", () => {
    render(
      <MemoryRouter>
        <Sidebar role="DOCTOR" />
      </MemoryRouter>,
    );

    expect(screen.getByRole("navigation", { name: "Doctor navigation" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "X-rays & AI" })).toHaveAttribute("href", "/doctor/xrays");
    expect(screen.queryByRole("link", { name: "Invoices" })).not.toBeInTheDocument();
  });
});
