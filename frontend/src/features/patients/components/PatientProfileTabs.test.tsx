import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "../../../auth/authStore";

import { PatientProfileTabs } from "./PatientProfileTabs";

describe("PatientProfileTabs", () => {
  beforeEach(() => useAuthStore.setState({ user: null, role: null }));
  it("shows Billing tab for Admin and Staff", () => {
    render(<PatientProfileTabs role="ADMIN" activeTab="overview" onTabChange={vi.fn()} />);
    expect(screen.getByRole("tab", { name: /Billing\s*\/\s*Handoff|Billing Handoff|الفوترة/ })).toBeInTheDocument();
  });

  it("hides Billing tab for Doctor", () => {
    render(<PatientProfileTabs role="DOCTOR" activeTab="overview" onTabChange={vi.fn()} />);
    expect(screen.queryByRole("tab", { name: /Billing\s*\/\s*Handoff|Billing Handoff|الفوترة/ })).not.toBeInTheDocument();
  });

  it("marks active tab selected", () => {
    render(<PatientProfileTabs role="STAFF" activeTab="medical" onTabChange={vi.fn()} />);
    expect(screen.getByRole("tab", { name: /Medical Summary|الملخص الطبي/ })).toHaveAttribute("aria-selected", "true");
  });
});
