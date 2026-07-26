import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { scheduleApi } from "../../api/endpoints/schedule";
import { useAuthStore } from "../../auth/authStore";
import type { AuthUser } from "../../types/auth";
import { OwnProfilePage } from "./OwnProfilePage";

const baseUser: AuthUser = {
  id: 7,
  email: "olivia@pearlix.test",
  full_name: "Olivia Bennett",
  role: "STAFF",
  is_active: true,
  must_change_password: false,
  password_changed_at: null,
  theme_preference: "LIGHT",
  language_preference: "EN",
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><OwnProfilePage /></QueryClientProvider>);
}

describe("OwnProfilePage", () => {
  afterEach(() => vi.restoreAllMocks());

  beforeEach(() => {
    useAuthStore.setState({ user: baseUser, role: "STAFF" });
    vi.spyOn(scheduleApi, "workingShifts").mockResolvedValue({ count: 0, next: null, previous: null, results: [] });
    vi.spyOn(scheduleApi, "availabilityExceptions").mockResolvedValue({ count: 0, next: null, previous: null, results: [] });
  });

  it("composes Staff identity, working hours, and leave in the shared profile visual hierarchy", async () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "Profile" })).toBeInTheDocument();
    expect(screen.getByText("Olivia Bennett")).toBeInTheDocument();
    expect(await screen.findByText("No working shifts have been assigned.")).toBeInTheDocument();
    expect(await screen.findByText("No leave or unavailable periods were returned.")).toBeInTheDocument();
  });

  it("localizes the new profile composition in Arabic", async () => {
    useAuthStore.setState({ user: { ...baseUser, language_preference: "AR" }, role: "STAFF" });
    renderPage();
    expect(screen.getByRole("heading", { name: "الملف الشخصي" })).toBeInTheDocument();
    expect(await screen.findByText("لم يتم تعيين ساعات عمل.")).toBeInTheDocument();
  });

  it("keeps Admin profile read-only without professional schedule requests", () => {
    useAuthStore.setState({ user: { ...baseUser, role: "ADMIN" }, role: "ADMIN" });
    renderPage();
    expect(screen.getByText("Profile information")).toBeInTheDocument();
    expect(scheduleApi.workingShifts).not.toHaveBeenCalled();
    expect(scheduleApi.availabilityExceptions).not.toHaveBeenCalled();
  });
});
