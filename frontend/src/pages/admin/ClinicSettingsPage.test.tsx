import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Link, RouterProvider, createMemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clinicApi } from "../../api/endpoints/clinic";
import { useAuthStore } from "../../auth/authStore";
import type { AuthUser } from "../../types/auth";
import type { ClinicSettings } from "../../types/clinic";
import { AdminClinicSettingsPage } from "./ClinicSettingsPage";

vi.mock("../../api/endpoints/clinic", () => ({ clinicApi: { getSettings: vi.fn(), updateSettings: vi.fn() } }));

const settings: ClinicSettings = { clinic_name: "Pearlix", address: "Damascus", phone: "1", email: "a@b.test", timezone: "Asia/Damascus", capacity_per_slot: 3, default_appointment_duration_minutes: 30, allowed_durations_minutes: [15, 30, 45, 60], default_currency: "SYP", supported_currencies: ["SYP", "USD"], default_language: "EN", ai_mode: "MOCK_ADAPTER", ai_service_url: "" };
const admin: AuthUser = { id: 1, email: "admin@pearlix.test", full_name: "Admin", role: "ADMIN", is_active: true, must_change_password: false, password_changed_at: null, theme_preference: "LIGHT", language_preference: "EN" };

function renderPage(client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  const router = createMemoryRouter([
    { path: "/admin/clinic-settings", element: <><Link to="/other">Navigate test</Link><AdminClinicSettingsPage /></> },
    { path: "/other", element: <p>Other page</p> },
  ], { initialEntries: ["/admin/clinic-settings"] });
  render(<QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider>);
  return { client, router };
}

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((next) => { resolve = next; });
  return { promise, resolve };
}

beforeEach(() => {
  vi.mocked(clinicApi.getSettings).mockResolvedValue(settings);
  vi.mocked(clinicApi.updateSettings).mockResolvedValue(settings);
  act(() => { useAuthStore.setState({ user: admin, role: "ADMIN" }); });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  act(() => { useAuthStore.setState({ user: null, role: null }); });
});

describe("Admin Clinic Settings production page", () => {
  it("shows a localized GET error and retries the production query", async () => {
    vi.mocked(clinicApi.getSettings).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(settings);
    renderPage();
    expect(await screen.findByText("Settings unavailable")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByLabelText("Clinic name")).toHaveValue("Pearlix");
    expect(clinicApi.getSettings).toHaveBeenCalledTimes(2);
  });

  it("renders the four explicit typed sections and PATCHes only exact changed typed fields", async () => {
    vi.mocked(clinicApi.updateSettings).mockResolvedValue({ ...settings, capacity_per_slot: 4, allowed_durations_minutes: [15, 30, 60] });
    renderPage();
    expect(await screen.findByText("Clinic identity")).toBeInTheDocument();
    expect(screen.getByText("Scheduling")).toBeInTheDocument();
    expect(screen.getByText("Localization and billing defaults")).toBeInTheDocument();
    expect(screen.getByText("AI workspace configuration")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Capacity per start-time slot"), { target: { value: "4" } });
    fireEvent.click(screen.getByLabelText("45"));
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));
    await waitFor(() => expect(clinicApi.updateSettings).toHaveBeenCalledWith({ capacity_per_slot: 4, allowed_durations_minutes: [15, 30, 60] }, expect.anything()));
    const payload = vi.mocked(clinicApi.updateSettings).mock.calls[0][0];
    expect(payload.capacity_per_slot).toEqual(4);
    expect(payload.allowed_durations_minutes).toEqual([15, 30, 60]);
    expect(Array.isArray(payload.allowed_durations_minutes)).toBe(true);
  });

  it("keeps an untouched Save action disabled", async () => {
    renderPage();
    expect(await screen.findByRole("button", { name: "Save settings" })).toBeDisabled();
  });

  it("validates capacity, duration/default, currency/default, email, and AI URL relationships", async () => {
    renderPage();
    await screen.findByLabelText("Capacity per start-time slot");
    fireEvent.change(screen.getByLabelText("Capacity per start-time slot"), { target: { value: "0" } });
    expect(screen.getByText("Capacity must be at least 1.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save settings" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Capacity per start-time slot"), { target: { value: "3" } });
    fireEvent.click(screen.getByLabelText("30"));
    expect(screen.getByText("Default duration must be allowed.")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("SYP"));
    expect(screen.getByText("Default currency must be supported.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "not-an-email" } });
    fireEvent.change(screen.getByLabelText("AI service URL"), { target: { value: "not-a-url" } });
    expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();
    expect(screen.getByText("Enter a valid AI service URL.")).toBeInTheDocument();
  });

  it("blocks beforeunload and internal navigation while settings are dirty", async () => {
    const { router } = renderPage();
    await screen.findByLabelText("Clinic name");
    fireEvent.change(screen.getByLabelText("Clinic name"), { target: { value: "Updated Pearlix" } });
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    fireEvent.click(screen.getByRole("link", { name: "Navigate test" }));
    expect(await screen.findByText("Discard unsaved changes?")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/admin/clinic-settings");
  });

  it("locks duplicate submission and navigation while a save is pending", async () => {
    const pending = deferred<ClinicSettings>();
    vi.mocked(clinicApi.updateSettings).mockReturnValueOnce(pending.promise);
    const { router } = renderPage();
    await screen.findByLabelText("Clinic name");
    fireEvent.change(screen.getByLabelText("Clinic name"), { target: { value: "Updated Pearlix" } });
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));
    await waitFor(() => expect(clinicApi.updateSettings).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Save settings" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));
    fireEvent.click(screen.getByRole("link", { name: "Navigate test" }));
    expect(await screen.findByText("Discard unsaved changes?")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/admin/clinic-settings");
    expect(clinicApi.updateSettings).toHaveBeenCalledTimes(1);
    pending.resolve({ ...settings, clinic_name: "Updated Pearlix" });
    expect(await screen.findByRole("status")).toHaveTextContent("Settings saved.");
    expect(router.state.location.pathname).toBe("/admin/clinic-settings");
  });

  it("preserves dirty values after a failed save", async () => {
    vi.mocked(clinicApi.updateSettings).mockRejectedValueOnce(new Error("save failed"));
    renderPage();
    await screen.findByLabelText("Clinic name");
    fireEvent.change(screen.getByLabelText("Clinic name"), { target: { value: "Updated Pearlix" } });
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));
    expect(await screen.findByText("Settings could not be saved.")).toBeInTheDocument();
    expect(screen.getByLabelText("Clinic name")).toHaveValue("Updated Pearlix");
    expect(screen.getByRole("button", { name: "Save settings" })).toBeEnabled();
  });

  it("uses a successful response as the baseline, announces success, disables Save, and invalidates dependent queries", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidate = vi.spyOn(client, "invalidateQueries");
    vi.mocked(clinicApi.updateSettings).mockResolvedValue({ ...settings, capacity_per_slot: 4 });
    renderPage(client);
    await screen.findByLabelText("Capacity per start-time slot");
    fireEvent.change(screen.getByLabelText("Capacity per start-time slot"), { target: { value: "4" } });
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Settings saved.");
    expect(screen.getByLabelText("Capacity per start-time slot")).toHaveValue(4);
    expect(screen.getByRole("button", { name: "Save settings" })).toBeDisabled();
    for (const key of ["clinic-settings", "dashboard", "appointments", "billing-handoffs", "invoice-print-data", "xrays", "xray-ai-result", "ai-configuration"]) expect(invalidate).toHaveBeenCalledWith({ queryKey: [key] });
    expect(useAuthStore.getState().user).toEqual(admin);
  });

  it("uses Arabic labels, localized AI modes, and an RTL page direction without changing preferences", async () => {
    act(() => { useAuthStore.setState({ user: { ...admin, language_preference: "AR" }, role: "ADMIN" }); });
    renderPage();
    expect(await screen.findByText("إعدادات العيادة")).toBeInTheDocument();
    expect(screen.getByText("هوية العيادة")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "داخلي في جانغو" })).toBeInTheDocument();
    expect(document.querySelector(".admin-page")).toHaveAttribute("dir", "rtl");
    expect(document.querySelector(".admin-page")).toHaveAttribute("lang", "ar");
    expect(useAuthStore.getState().user?.language_preference).toBe("AR");
    expect(useAuthStore.getState().user?.theme_preference).toBe("LIGHT");
  });
});
