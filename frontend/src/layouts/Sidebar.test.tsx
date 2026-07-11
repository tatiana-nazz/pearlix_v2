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
    expect(navigationByRole.ADMIN.some((item) => item.path.includes("profile"))).toBe(false);
  });

  it("renders accessible links for the current workspace", () => {
    render(
      <MemoryRouter>
        <Sidebar role="DOCTOR" />
      </MemoryRouter>,
    );

    expect(screen.getByRole("navigation", { name: "Doctor navigation" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "External X-ray Workspace" })).toHaveAttribute("href", "/doctor/external-xrays");
    expect(screen.queryByRole("link", { name: "Invoices" })).not.toBeInTheDocument();
  });
});
