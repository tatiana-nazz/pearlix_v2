import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PatientProfileTabs } from "./PatientProfileTabs";

describe("PatientProfileTabs", () => {
  it("shows Billing tab for Admin and Staff", () => {
    render(<PatientProfileTabs role="ADMIN" activeTab="overview" onTabChange={vi.fn()} />);
    expect(screen.getByRole("tab", { name: "Billing/Handoff" })).toBeInTheDocument();
  });

  it("hides Billing tab for Doctor", () => {
    render(<PatientProfileTabs role="DOCTOR" activeTab="overview" onTabChange={vi.fn()} />);
    expect(screen.queryByRole("tab", { name: "Billing/Handoff" })).not.toBeInTheDocument();
  });

  it("marks active tab selected", () => {
    render(<PatientProfileTabs role="STAFF" activeTab="medical" onTabChange={vi.fn()} />);
    expect(screen.getByRole("tab", { name: "Medical Summary" })).toHaveAttribute("aria-selected", "true");
  });

  it("activates the next tab with keyboard navigation", async () => {
    const onTabChange = vi.fn();
    render(<PatientProfileTabs role="STAFF" activeTab="overview" onTabChange={onTabChange} />);
    screen.getByRole("tab", { name: "Overview" }).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(onTabChange).toHaveBeenCalledWith("medical");
  });
});
