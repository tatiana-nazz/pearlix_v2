import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PatientProfileTabs } from "./PatientProfileTabs";

describe("PatientProfileTabs keyboard and semantic contract", () => {
  afterEach(() => { document.documentElement.dir = "ltr"; });

  it("links the selected tab to its profile panel and keeps roving tab stops", () => {
    render(<PatientProfileTabs role="STAFF" activeTab="overview" onTabChange={vi.fn()} />);
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-controls", "patient-profile-panel-overview");
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("tab", { name: "Medical Summary" })).toHaveAttribute("tabindex", "-1");
  });

  it("moves forward with ArrowRight and announces the selected destination through the callback", () => {
    const onTabChange = vi.fn();
    render(<PatientProfileTabs role="STAFF" activeTab="overview" onTabChange={onTabChange} />);
    fireEvent.keyDown(screen.getByRole("tab", { name: "Overview" }), { key: "ArrowRight" });
    expect(onTabChange).toHaveBeenCalledWith("medical");
  });

  it("supports Home and End without exposing a Doctor billing tab", () => {
    const onTabChange = vi.fn();
    render(<PatientProfileTabs role="DOCTOR" activeTab="medical" onTabChange={onTabChange} />);
    fireEvent.keyDown(screen.getByRole("tab", { name: "Medical Summary" }), { key: "Home" });
    fireEvent.keyDown(screen.getByRole("tab", { name: "Medical Summary" }), { key: "End" });
    expect(onTabChange).toHaveBeenNthCalledWith(1, "overview");
    expect(onTabChange).toHaveBeenNthCalledWith(2, "xrays");
    expect(screen.queryByRole("tab", { name: "Billing / Handoff" })).not.toBeInTheDocument();
  });

  it("reverses horizontal arrows in RTL", () => {
    document.documentElement.dir = "rtl";
    const onTabChange = vi.fn();
    render(<PatientProfileTabs role="STAFF" activeTab="medical" onTabChange={onTabChange} />);
    fireEvent.keyDown(screen.getByRole("tab", { name: "Medical Summary" }), { key: "ArrowRight" });
    expect(onTabChange).toHaveBeenCalledWith("overview");
  });
});
