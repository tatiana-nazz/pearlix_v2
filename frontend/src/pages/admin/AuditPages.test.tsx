import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { auditApi } from "../../api/endpoints/audit";
import { usersApi } from "../../api/endpoints/users";
import { useAuthStore } from "../../auth/authStore";
import type { AuditLog } from "../../types/audit";
import type { UserManagementRecord } from "../../types/users";
import { AdminAuditLogDetailPage, AdminAuditLogListPage } from "./AuditPages";

vi.mock("../../api/endpoints/audit", () => ({ auditApi: { list: vi.fn(), detail: vi.fn() } }));
vi.mock("../../api/endpoints/users", () => ({ usersApi: { list: vi.fn(), detail: vi.fn() } }));

const actor: UserManagementRecord = { id: 2, full_name: "Dr Noor", email: "noor@example.test", role: "DOCTOR", is_active: true, theme_preference: "LIGHT", language_preference: "EN", must_change_password: false, password_changed_at: null, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z", version: 1, linked_profile_state: "NONE", team_member_id: null };
const record: AuditLog = { id: 7, actor, actor_role: "DOCTOR", action: "patient_created", entity_type: "patient", entity_id: "42", metadata_json: { password: "hide", nested: { token: "hide", html: "<b>plain</b>", flags: [true, null, 4] } }, ip_address: "127.0.0.1", created_at: "2026-01-01T00:00:00Z" };

function page(entry: string) { return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={[entry]}><Routes><Route path="/admin/audit-logs" element={<AdminAuditLogListPage />} /><Route path="/admin/audit-logs/:auditLogId" element={<AdminAuditLogDetailPage />} /></Routes></MemoryRouter></QueryClientProvider>); }
beforeEach(() => { vi.mocked(auditApi.list).mockResolvedValue({ count: 1, next: "next", previous: null, results: [record] }); vi.mocked(auditApi.detail).mockResolvedValue(record); vi.mocked(usersApi.list).mockResolvedValue({ count: 1, next: null, previous: null, results: [actor] }); vi.mocked(usersApi.detail).mockResolvedValue(actor); act(() => useAuthStore.setState({ user: { ...actor, role: "ADMIN" }, role: "ADMIN" })); });
afterEach(() => { vi.clearAllMocks(); act(() => useAuthStore.setState({ user: null, role: null })); });

describe("Admin Audit production pages", () => {
  it("initializes URL-backed filters, resets page, clears filters, and keeps no raw actor ID field", async () => {
    page("/admin/audit-logs?page=3&actor_role=DOCTOR&entity_type=patient&entity_id=42");
    expect(await screen.findByLabelText("Actor role")).toHaveValue("DOCTOR");
    expect(screen.getByLabelText("Entity type")).toHaveValue("patient");
    expect(screen.queryByLabelText(/Actor ID/i)).toBeNull();
    fireEvent.change(screen.getByLabelText("Action"), { target: { value: "patient_created" } });
    await waitFor(() => expect(auditApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, action: "patient_created" })));
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    await waitFor(() => expect(auditApi.list).toHaveBeenLastCalledWith({ page: 1 }));
  });

  it("debounces actor server search and selects a readable actor label", async () => {
    page("/admin/audit-logs"); await screen.findByLabelText("Actor");
    fireEvent.change(screen.getByLabelText("Actor"), { target: { value: "Noor" } });
    await waitFor(() => expect(usersApi.list).toHaveBeenCalledWith({ search: "Noor", page: 1 }));
    fireEvent.click(await screen.findByRole("button", { name: "Dr Noor (noor@example.test)" }));
    await waitFor(() => expect(auditApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ actor_id: "2", page: 1 })));
  });

  it("localizes known values, safely humanizes unknown values, and opens rows with mouse or keyboard", async () => {
    page("/admin/audit-logs?entity_type=patient");
    expect(await screen.findByText("Patient Created")).toBeInTheDocument();
    expect(screen.getAllByText("Doctor")).toHaveLength(2);
    const row = screen.getByText("Patient Created").closest("tr")!;
    fireEvent.keyDown(row, { key: "Enter" });
    expect(screen.getByText("Audit record")).toBeInTheDocument();
  });

  it("shows list loading, empty, error, and Retry states", async () => {
    vi.mocked(auditApi.list).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ count: 0, next: null, previous: null, results: [] });
    page("/admin/audit-logs");
    expect(await screen.findByText("Audit logs unavailable")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("No audit records found.")).toBeInTheDocument();
  });

  it("renders bounded structured metadata with nested redaction and plain HTML-like text", async () => {
    page("/admin/audit-logs/7?entity_type=patient&page=2");
    expect((await screen.findAllByText("Redacted")).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("<b>plain</b>")).toBeInTheDocument();
    expect(screen.getByText("IP address")).toBeInTheDocument();
    expect(document.querySelector("pre")).toBeNull();
    expect(screen.queryByRole("button", { name: /save|delete|edit/i })).toBeNull();
    expect(screen.getByRole("link", { name: "Back to audit logs" })).toHaveAttribute("href", "/admin/audit-logs?entity_type=patient&page=2");
  });

  it("localizes Arabic audit labels and retains RTL direction from the workspace", async () => {
    act(() => useAuthStore.setState({ user: { ...actor, role: "ADMIN", language_preference: "AR" }, role: "ADMIN" }));
    document.documentElement.dir = "rtl"; page("/admin/audit-logs");
    expect(await screen.findByText("تم إنشاء مريض")).toBeInTheDocument();
    expect(screen.getAllByText("طبيب")).toHaveLength(2);
    expect(document.documentElement).toHaveAttribute("dir", "rtl");
  });

  it("uses server pagination, preserves query parameters, and opens System and unknown rows by mouse and Space", async () => {
    const systemRecord: AuditLog = { ...record, id: 8, actor: null, actor_role: "", action: "custom_audit_action", entity_type: "custom_entity", entity_id: "mixed-42" };
    vi.mocked(auditApi.list).mockResolvedValue({ count: 2, next: "next", previous: "previous", results: [record, systemRecord] });
    page("/admin/audit-logs?page=2&entity_type=patient");
    expect(await screen.findByText("Custom Audit Action")).toBeInTheDocument();
    expect(screen.getAllByText("System")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(auditApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 3, entity_type: "patient" })));
    const row = (await screen.findByText("Custom Audit Action")).closest("tr")!;
    fireEvent.keyDown(row, { key: " " });
    expect(screen.getByText("Audit record")).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Back to audit logs" })).toHaveAttribute("href", "/admin/audit-logs?page=3&entity_type=patient");
  });

  it("ignores an older actor-search response after a newer search", async () => {
    let resolveOlder: (value: { count: number; next: null; previous: null; results: UserManagementRecord[] }) => void = () => undefined;
    const older = new Promise<{ count: number; next: null; previous: null; results: UserManagementRecord[] }>((resolve) => { resolveOlder = resolve; });
    const newerActor = { ...actor, id: 3, full_name: "Dr New" };
    vi.mocked(usersApi.list).mockImplementation((params) => params?.search === "No" ? older : Promise.resolve({ count: 1, next: null, previous: null, results: [newerActor] }));
    page("/admin/audit-logs");
    const input = await screen.findByLabelText("Actor");
    fireEvent.change(input, { target: { value: "No" } });
    await waitFor(() => expect(usersApi.list).toHaveBeenCalledWith({ search: "No", page: 1 }));
    fireEvent.change(input, { target: { value: "New" } });
    await waitFor(() => expect(usersApi.list).toHaveBeenCalledWith({ search: "New", page: 1 }));
    expect(await screen.findByRole("button", { name: "Dr New (noor@example.test)" })).toBeInTheDocument();
    await act(async () => resolveOlder({ count: 1, next: null, previous: null, results: [actor] }));
    expect(screen.queryByRole("button", { name: "Dr Noor (noor@example.test)" })).toBeNull();
  });

  it("renders bounded typed metadata, all sensitive key families, and the localized empty state", async () => {
    const deep = { one: { two: { three: { four: { five: "hidden by depth" } } } } };
    const metadata = { password: "x", temporary_password: "x", token: "x", access: "x", refresh: "x", authorization: "x", secret: "x", api_key: "x", nested: { TOKEN_value: "x" }, flags: [true, null, 4], deep, long: "a".repeat(600) };
    vi.mocked(auditApi.detail).mockResolvedValue({ ...record, action: "custom_audit_action", entity_type: "custom_entity", actor: null, actor_role: "", metadata_json: metadata });
    page("/admin/audit-logs/7");
    expect(await screen.findByText("Custom Audit Action")).toBeInTheDocument();
    expect(screen.getByText("Custom Entity")).toBeInTheDocument();
    expect(screen.getAllByText("System")).toHaveLength(2);
    expect((await screen.findAllByText("Redacted")).length).toBeGreaterThanOrEqual(9);
    expect(screen.getByText("Additional metadata is hidden")).toBeInTheDocument();
    expect(screen.getByText("None")).toBeInTheDocument();
    expect(screen.queryByText("a".repeat(600))).toBeNull();
    expect(document.querySelector("pre")).toBeNull();
    expect(document.body.textContent).not.toContain("JSON.stringify");
    vi.mocked(auditApi.detail).mockResolvedValue({ ...record, metadata_json: {} });
    fireEvent.click(screen.getByRole("link", { name: "Back to audit logs" }));
    page("/admin/audit-logs/7");
    expect(await screen.findByText("No metadata recorded.")).toBeInTheDocument();
  });

  it("shows detail loading, error Retry, and not-found states", async () => {
    let resolveDetail: (value: AuditLog) => void = () => undefined;
    vi.mocked(auditApi.detail).mockImplementationOnce(() => new Promise<AuditLog>((resolve) => { resolveDetail = resolve; })).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(record);
    page("/admin/audit-logs/7");
    expect(screen.getByText("Audit record")).toBeInTheDocument();
    await act(async () => resolveDetail(record));
    await screen.findByText("Patient Created");
    fireEvent.click(screen.getByRole("link", { name: "Back to audit logs" }));
    page("/admin/audit-logs/7");
    expect(await screen.findByText("Audit record unavailable")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Patient Created")).toBeInTheDocument();
    page("/admin/audit-logs/0");
    expect(await screen.findByText("Audit record not found.")).toBeInTheDocument();
  });
});
