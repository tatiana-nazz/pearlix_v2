import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "../../../auth/authStore";
import type { AuthUser } from "../../../types/auth";
import type { ExternalXrayCase } from "../../../types/xrays";

const mutations = vi.hoisted(() => ({ upload: { reset: vi.fn(), isPending: false, error: null }, runAi: { mutateAsync: vi.fn(), reset: vi.fn(), isPending: false, error: null, data: undefined }, attach: { reset: vi.fn(), mutateAsync: vi.fn(), isPending: false, error: null }, discard: { reset: vi.fn(), mutateAsync: vi.fn(), isPending: false, error: null } }));
vi.mock("../hooks/useXrays", () => ({ useExternalAiResult: () => ({ data: undefined, isLoading: false, error: null, refetch: vi.fn() }), useExternalXrayMutations: () => mutations }));
vi.mock("./ProtectedXrayImage", () => ({ ProtectedXrayImage: () => <p>Protected image</p> }));

import { ExternalXrayDetail } from "./ExternalXrayDetail";

const doctor: AuthUser = { id: 2, full_name: "Dr. Lin", email: "doctor@example.test", role: "DOCTOR", is_active: true, theme_preference: "LIGHT", language_preference: "EN", must_change_password: false, password_changed_at: null };
const external: ExternalXrayCase = { id: 4, uploaded_by: doctor, title: "External", notes: "", status: "TEMPORARY", stored_file_name: "stored-external.png", original_file_name: "external.png", content_type: "image/png", size_bytes: 200, created_at: "2026-07-20T09:00:00Z", updated_at: "2026-07-20T09:00:00Z", file_endpoint: "/external-xrays/4/file/", ai_result_endpoint: "/external-xrays/4/ai-result/", ai_overlay_endpoint: "/external-xrays/4/ai-overlay/", has_ai_result: false, attached_patient: null, attached_visit: null, attached_xray: null, attached_at: null, discarded_at: null };
function renderDetail(role: "ADMIN" | "DOCTOR" | "STAFF", value = external) { return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter><ExternalXrayDetail role={role} external={value} /></MemoryRouter></QueryClientProvider>); }

describe("External X-ray ownership action matrix", () => {
  afterEach(() => { useAuthStore.setState({ user: null }); });

  it("shows Admin upload-case management without attach, Doctor own actions, and no actions for Staff or another Doctor", () => {
    useAuthStore.setState({ user: { ...doctor, role: "ADMIN" } });
    const view = renderDetail("ADMIN");
    expect(screen.getByRole("button", { name: "Run AI" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Attach to patient" })).not.toBeInTheDocument();
    view.unmount();
    useAuthStore.setState({ user: doctor });
    const own = renderDetail("DOCTOR");
    expect(screen.getByRole("button", { name: "Attach to patient" })).toBeInTheDocument();
    own.unmount();
    renderDetail("DOCTOR", { ...external, uploaded_by: { ...doctor, id: 8, full_name: "Dr. Other" } });
    expect(screen.queryByRole("button", { name: "Run AI" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Discard case" })).not.toBeInTheDocument();
  });
});
