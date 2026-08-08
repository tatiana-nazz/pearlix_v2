import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { auditApi } from "../../api/endpoints/audit";
import type { AuditLog } from "../../types/audit";
import { AdminAuditLogDetailPage, AdminAuditLogListPage } from "./AdminManagementPages";

vi.mock("../../api/endpoints/audit", () => ({
  auditApi: {
    list: vi.fn(),
    detail: vi.fn(),
  },
}));

const auditRecord: AuditLog = {
  id: 42,
  actor: {
    id: 7,
    email: "admin@example.test",
    full_name: "Pearlix Admin",
    role: "ADMIN",
    is_active: true,
    theme_preference: "LIGHT",
    language_preference: "EN",
  },
  actor_role: "ADMIN",
  action: "USER_UPDATED",
  entity_type: "User",
  entity_id: "17",
  metadata_json: {
    changed: ["full_name"],
    password: "must-not-render",
    nested: { access_token: "also-secret" },
  },
  ip_address: "127.0.0.1",
  created_at: "2026-08-08T09:30:00Z",
};

function TestProviders({ children }: PropsWithChildren) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("Admin audit logs", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("renders detail from the route ID without an invalid hook call and redacts sensitive metadata", async () => {
    vi.mocked(auditApi.detail).mockResolvedValue(auditRecord);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(
      <TestProviders>
        <MemoryRouter initialEntries={["/admin/audit-logs/42"]}>
          <Routes><Route path="/admin/audit-logs/:auditLogId" element={<AdminAuditLogDetailPage />} /></Routes>
        </MemoryRouter>
      </TestProviders>,
    );

    expect(await screen.findByRole("heading", { name: "Audit Record" })).toBeInTheDocument();
    await waitFor(() => expect(auditApi.detail).toHaveBeenCalledWith(42));
    expect(screen.getByText("USER_UPDATED")).toBeInTheDocument();
    expect(screen.getByLabelText("Audit metadata")).toHaveTextContent("[redacted]");
    expect(screen.getByLabelText("Audit metadata")).not.toHaveTextContent("must-not-render");
    expect(screen.getByLabelText("Audit metadata")).not.toHaveTextContent("also-secret");
    expect(consoleError.mock.calls.flat().join(" ")).not.toContain("Invalid hook call");
  });

  it("requests the paginated list and opens the exact record with keyboard activation", async () => {
    vi.mocked(auditApi.list).mockResolvedValue({ count: 1, next: null, previous: null, results: [auditRecord] });

    render(
      <TestProviders>
        <MemoryRouter initialEntries={["/admin/audit-logs"]}>
          <Routes>
            <Route path="/admin/audit-logs" element={<AdminAuditLogListPage />} />
            <Route path="/admin/audit-logs/:auditLogId" element={<p>Opened exact audit record</p>} />
          </Routes>
        </MemoryRouter>
      </TestProviders>,
    );

    expect(await screen.findByRole("table", { name: "Audit records" })).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader").map((header) => header.textContent)).toEqual(["Time", "Actor", "Action", "Entity"]);
    expect(auditApi.list).toHaveBeenCalledWith({ page: 1 });
    fireEvent.keyDown(screen.getByRole("row", { name: "Open audit record 42" }), { key: "Enter" });
    expect(await screen.findByText("Opened exact audit record")).toBeInTheDocument();
  });
});
