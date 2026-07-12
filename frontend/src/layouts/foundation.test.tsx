import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { Sidebar } from "./Sidebar";
import { navigationByRole } from "./navigation";
import { t } from "./i18n";

describe("Phase 14C shell, language, and Lucide navigation contracts", () => {
  it("maps every permitted role route to a Lucide icon and never exposes Team", () => {
    for (const [role, items] of Object.entries(navigationByRole)) {
      expect(items).not.toHaveLength(0);
      expect(items.every((item) => item.path.startsWith(`/${role.toLowerCase()}/`) && Boolean(item.icon))).toBe(true);
      expect(items.some((item) => item.path === "/admin/team")).toBe(false);
    }
  });

  it("renders current route as active and compact links with accessible labels rather than letter substitutes", () => {
    render(<MemoryRouter initialEntries={["/admin/patients"]}><Sidebar role="ADMIN" collapsed /></MemoryRouter>);
    const patients = screen.getByRole("link", { name:"Patients" });
    expect(patients).toHaveClass("active");
    expect(patients.querySelector("svg")).toBeTruthy();
    expect(screen.getByRole("button", { name:"Expand navigation" })).toHaveAttribute("data-tooltip", "Expand navigation");
    expect(screen.queryByRole("link", { name:/Team/ })).not.toBeInTheDocument();
  });

  it("keeps the static shell dictionary translated without claiming feature-page translation", () => {
    expect(t("EN", "workspace")).toBe("Workspace");
    expect(t("AR", "workspace")).not.toBe("Workspace");
    expect(t("AR", "logout")).not.toBe("Logout");
  });
});
