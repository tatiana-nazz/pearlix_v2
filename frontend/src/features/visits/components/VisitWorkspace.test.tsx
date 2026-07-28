import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "../../../auth/authStore";
import { visitsApi } from "../../../api/endpoints/visits";
import type { AuthUser } from "../../../types/auth";
import type { VisitDetail } from "../../../types/visits";
import { VisitWorkspace } from "./VisitWorkspace";

vi.mock("../../xrays/components/VisitXraySection", () => ({ VisitXraySection: () => <section>X-ray boundary</section> }));
vi.mock("../../billing/components/VisitBillingSection", () => ({ VisitBillingSection: () => <section>Billing boundary</section> }));

class JsdomRequest {
  readonly body: null = null;
  readonly headers: Headers;
  readonly method: string;
  readonly signal: AbortSignal;
  readonly url: string;
  constructor(input: string | URL, init: RequestInit = {}) { this.url = String(input); this.method = init.method ?? "GET"; this.headers = new Headers(init.headers); this.signal = init.signal ?? new AbortController().signal; }
}
Object.defineProperty(globalThis, "Request", { configurable: true, value: JsdomRequest });

const visit: VisitDetail = {
  id: 8,
  appointment: { id: 7, start_datetime: "2026-07-20T09:00:00+03:00", end_datetime: "2026-07-20T09:30:00+03:00", duration_minutes: 30, status: "ACTIVE", reason: "Tooth pain" },
  patient: { id: 9, first_name: "Maya", last_name: "Patient", full_name: "Maya Patient", gender: "Female", date_of_birth: null, age: 31, phone_number: "555", email: "maya@example.test", national_id_or_passport: null, blood_group: "", is_archived: false, version: 1, created_at: "2026-07-01T00:00:00Z", updated_at: "2026-07-01T00:00:00Z" },
  doctor: { id: 2, full_name: "Dr. Lin", email: "lin@example.test", role: "DOCTOR", is_active: true, theme_preference: "LIGHT", language_preference: "EN" },
  status: "ACTIVE", started_at: "2026-07-20T09:00:00+03:00", completed_at: null,
  symptoms: "Pain", diagnosis: "", treatment: "", clinical_notes: "", follow_up_notes: "",
  created_at: "2026-07-20T09:00:00+03:00", updated_at: "2026-07-20T09:00:00+03:00",
};
const doctorUser: AuthUser = { id: 2, full_name: "Dr. Lin", email: "lin@example.test", role: "DOCTOR", is_active: true, theme_preference: "LIGHT", language_preference: "EN", must_change_password: false, password_changed_at: null };

function renderWorkspace(role: "ADMIN" | "STAFF" | "DOCTOR" = "DOCTOR") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const router = createMemoryRouter([
    { path: "/doctor/visits/active", element: <QueryClientProvider client={queryClient}><VisitWorkspace role={role} visit={visit} /></QueryClientProvider> },
    { path: "/doctor/appointments/day", element: <p>Day appointments</p> },
    { path: "/doctor/patients/9", element: <p>Patient profile</p> },
  ], { initialEntries: ["/doctor/visits/active"] });
  return { router, ...render(<RouterProvider router={router} />) };
}

describe("VisitWorkspace production workflow", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useAuthStore.setState({ user: null });
  });

  it("saves the supported five-field clinical-note payload and refreshes the dirty baseline", async () => {
    useAuthStore.setState({ user: doctorUser });
    const update = vi.spyOn(visitsApi, "updateClinicalNotes").mockResolvedValue({ ...visit, diagnosis: "Caries" });
    renderWorkspace();
    const user = userEvent.setup();
    await user.type(screen.getByRole("textbox", { name: "Diagnosis" }), "Caries");
    expect(window.dispatchEvent(new Event("beforeunload", { cancelable: true }))).toBe(false);
    await user.click(screen.getByRole("button", { name: "Save notes" }));
    await waitFor(() => expect(update).toHaveBeenCalledWith(8, { symptoms: "Pain", diagnosis: "Caries", treatment: "", clinical_notes: "", follow_up_notes: "" }));
    await waitFor(() => expect(window.dispatchEvent(new Event("beforeunload", { cancelable: true }))).toBe(true));
  });

  it("blocks internal navigation while dirty until the doctor explicitly discards it", async () => {
    useAuthStore.setState({ user: doctorUser });
    const { router } = renderWorkspace();
    fireEvent.change(screen.getByRole("textbox", { name: "Diagnosis" }), { target: { value: "Caries" } });
    await router.navigate("/doctor/patients/9");
    expect(await screen.findByRole("dialog", { name: "Discard unsaved clinical notes?" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/doctor/patients/9"));
  });

  it("saves dirty notes before one completion request and routes to doctor day appointments", async () => {
    useAuthStore.setState({ user: doctorUser });
    const update = vi.spyOn(visitsApi, "updateClinicalNotes").mockResolvedValue({ ...visit, diagnosis: "Caries" });
    const complete = vi.spyOn(visitsApi, "complete").mockResolvedValue({ ...visit, status: "COMPLETED", completed_at: "2026-07-20T10:00:00+03:00" });
    const { router } = renderWorkspace();
    fireEvent.change(screen.getByRole("textbox", { name: "Diagnosis" }), { target: { value: "Caries" } });
    fireEvent.click(screen.getByRole("button", { name: "Complete visit" }));
    fireEvent.click(await screen.findByRole("button", { name: "Save and complete" }));
    await waitFor(() => expect(update).toHaveBeenCalledOnce());
    await waitFor(() => expect(complete).toHaveBeenCalledWith(8));
    await waitFor(() => expect(router.state.location.pathname).toBe("/doctor/appointments/day"));
  });

  it("keeps Staff and Admin clinical content read-only", () => {
    useAuthStore.setState({ user: doctorUser });
    renderWorkspace("STAFF");
    expect(screen.queryByRole("button", { name: "Complete visit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Diagnosis" })).not.toBeInTheDocument();
  });
});
