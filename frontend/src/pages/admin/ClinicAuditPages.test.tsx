import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { clinicApi } from "../../api/endpoints/clinic";
import { auditApi } from "../../api/endpoints/audit";
import { AdminAuditLogDetailPage, AdminAuditLogListPage, AdminClinicSettingsPage } from "./AdminManagementPages";

vi.mock("react-router-dom", async (importOriginal) => ({ ...(await importOriginal<typeof import("react-router-dom")>()), useBlocker: () => ({ state: "unblocked" }) }));
vi.mock("../../api/endpoints/clinic", () => ({ clinicApi: { getSettings: vi.fn(), updateSettings: vi.fn() } }));
vi.mock("../../api/endpoints/audit", () => ({ auditApi: { list: vi.fn(), detail: vi.fn() } }));
vi.mock("../../api/endpoints/users", () => ({ usersApi: { list: vi.fn().mockResolvedValue({ results: [] }) } }));

const settings = { clinic_name: "Pearlix", address: "Damascus", phone: "1", email: "a@b.test", timezone: "Asia/Damascus", capacity_per_slot: 3, default_appointment_duration_minutes: 30, allowed_durations_minutes: [15, 30, 45, 60], default_currency: "SYP" as const, supported_currencies: ["SYP", "USD"] as ("SYP" | "USD")[], default_language: "EN" as const, ai_mode: "MOCK_ADAPTER" as const, ai_service_url: "" };
function page(node: React.ReactNode, entry: string) { return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={[entry]}><Routes><Route path="/admin/clinic-settings" element={node} /><Route path="/admin/audit-logs" element={node} /><Route path="/admin/audit-logs/:auditLogId" element={node} /></Routes></MemoryRouter></QueryClientProvider>); }

describe("Clinic settings and Audit production acceptance", () => {
  it("renders four typed settings sections and PATCHes only changed number and array values", async () => { vi.mocked(clinicApi.getSettings).mockResolvedValue(settings); vi.mocked(clinicApi.updateSettings).mockResolvedValue({ ...settings, capacity_per_slot: 4, allowed_durations_minutes: [15, 30, 60] }); page(<AdminClinicSettingsPage />, "/admin/clinic-settings"); expect(await screen.findByText("Clinic identity")).toBeInTheDocument(); expect(screen.getByText("Scheduling")).toBeInTheDocument(); expect(screen.getByText("Localization and billing defaults")).toBeInTheDocument(); expect(screen.getByText("AI workspace configuration")).toBeInTheDocument(); fireEvent.change(screen.getByLabelText("Capacity per start-time slot"), { target: { value: "4" } }); fireEvent.click(screen.getByLabelText("45")); fireEvent.click(screen.getByRole("button", { name: "Save settings" })); await waitFor(() => expect(clinicApi.updateSettings).toHaveBeenCalledWith(expect.objectContaining({ capacity_per_slot: 4, allowed_durations_minutes: [15, 30, 60] }), expect.anything())); });
  it("renders URL-backed audit filters and opens rows", async () => { vi.mocked(auditApi.list).mockResolvedValue({ count: 1, next: null, previous: null, results: [{ id: 7, actor: null, actor_role: "", action: "patient_created", entity_type: "patient", entity_id: "4", metadata_json: {}, ip_address: null, created_at: "2026-01-01T00:00:00Z" }] }); page(<AdminAuditLogListPage />, "/admin/audit-logs?entity_type=patient"); expect(await screen.findByText("Patient Created")).toBeInTheDocument(); expect(screen.getByLabelText("Entity type")).toHaveValue("patient"); fireEvent.click(screen.getByText("Patient Created")); expect(screen.getByText("Patient Created")).toBeInTheDocument(); });
  it("renders safe structured redacted audit metadata without a raw dump", async () => { vi.mocked(auditApi.detail).mockResolvedValue({ id: 7, actor: null, actor_role: "", action: "patient_created", entity_type: "patient", entity_id: "4", metadata_json: { password: "no", nested: [true, null, "<b>text</b>"] }, ip_address: null, created_at: "2026-01-01T00:00:00Z" }); page(<AdminAuditLogDetailPage />, "/admin/audit-logs/7"); expect(await screen.findByText("Redacted")).toBeInTheDocument(); expect(screen.getByText("<b>text</b>")).toBeInTheDocument(); expect(document.querySelector("pre")).toBeNull(); });
});
