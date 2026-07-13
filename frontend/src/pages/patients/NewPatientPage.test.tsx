import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { useCreatePatient } from "../../features/patients/hooks/usePatientMutations";
import { NewPatientPage } from "./NewPatientPage";

class JsdomRequest {
  readonly body: null = null;
  readonly headers: Headers;
  readonly method: string;
  readonly signal: AbortSignal;
  readonly url: string;

  constructor(input: string | URL, init: RequestInit = {}) {
    this.url = String(input);
    this.method = init.method ?? "GET";
    this.headers = new Headers(init.headers);
    this.signal = init.signal ?? new AbortController().signal;
  }
}

// React Router creates browser Request objects for data-router navigation. jsdom
// supplies DOM AbortSignals while Node's undici Request expects Node signals.
// This browser-shaped test request keeps the route test on the production router.
Object.defineProperty(globalThis, "Request", { configurable: true, value: JsdomRequest });

vi.mock("../../features/patients/hooks/usePatientMutations", () => ({ useCreatePatient: vi.fn() }));

function renderPage(role: "ADMIN" | "STAFF" | "DOCTOR" = "STAFF", entry = "/staff/patients/new") {
  const router = createMemoryRouter([
    { path: "/staff/patients/new", element: <NewPatientPage role={role} /> },
    { path: "/admin/patients/new", element: <NewPatientPage role={role} /> },
    { path: "/doctor/patients/new", element: <NewPatientPage role={role} /> },
    { path: "/staff/patients/:patientId", element: <p>Patient profile</p> },
    { path: "/staff/patients", element: <p>Patient list</p> },
    { path: "/access-denied", element: <p>Access denied</p> },
  ], { initialEntries: [entry] });
  const view = render(<RouterProvider router={router} />);
  return { router, ...view };
}

function createMutationStub(mutateAsync: ReturnType<typeof vi.fn>) {
  return {
    context: undefined,
    data: undefined,
    error: null,
    failureCount: 0,
    failureReason: null,
    isError: false,
    isIdle: true,
    isPaused: false,
    isPending: false,
    isSuccess: false,
    mutate: vi.fn(),
    mutateAsync,
    reset: vi.fn(),
    status: "idle" as const,
    submittedAt: 0,
    variables: undefined,
  } satisfies ReturnType<typeof useCreatePatient>;
}

function createPendingMutationStub(mutateAsync: ReturnType<typeof vi.fn>) {
  return {
    context: undefined,
    data: undefined,
    error: null,
    failureCount: 0,
    failureReason: null,
    isError: false,
    isIdle: false,
    isPaused: false,
    isPending: true,
    isSuccess: false,
    mutate: vi.fn(),
    mutateAsync,
    reset: vi.fn(),
    status: "pending" as const,
    submittedAt: 1,
    variables: { first_name: "Nour", last_name: "Haddad", gender: "Female" as const },
  } satisfies ReturnType<typeof useCreatePatient>;
}

describe("New patient production route", () => {
  it("allows Staff only, with the production router denying Admin and Doctor", async () => {
    vi.mocked(useCreatePatient).mockReturnValue(createMutationStub(vi.fn()));
    const { router: admin } = renderPage("ADMIN", "/admin/patients/new");
    await waitFor(() => expect(admin.state.location.pathname).toBe("/access-denied"));
    const { router: doctor } = renderPage("DOCTOR", "/doctor/patients/new");
    await waitFor(() => expect(doctor.state.location.pathname).toBe("/access-denied"));
  });

  it("allows the successful create navigation through the blocker after a dirty form", async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ id: 42 });
    vi.mocked(useCreatePatient).mockReturnValue(createMutationStub(mutateAsync));
    const { router } = renderPage();

    fireEvent.change(await screen.findByLabelText(/First name/), { target: { value: "Nour" } });
    fireEvent.change(screen.getByLabelText(/Last name/), { target: { value: "Haddad" } });
    fireEvent.click(screen.getByRole("button", { name: "Create patient" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/staff/patients/42"));
    expect(screen.getByText("Patient profile")).toBeInTheDocument();
    expect(mutateAsync).toHaveBeenCalledTimes(1);
  });

  it("blocks ordinary route navigation until the user discards the changed form", async () => {
    vi.mocked(useCreatePatient).mockReturnValue(createMutationStub(vi.fn()));
    const { router } = renderPage();

    fireEvent.change(await screen.findByLabelText(/First name/), { target: { value: "Nour" } });
    await act(async () => { await router.navigate("/staff/patients"); });
    expect(await screen.findByRole("dialog", { name: "Discard unsaved changes?" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/staff/patients"));
  });

  it("lets an untouched cancel navigate directly, while Keep editing retains a dirty form and restores focus", async () => {
    vi.mocked(useCreatePatient).mockReturnValue(createMutationStub(vi.fn()));
    const { router } = renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/staff/patients"));

    const { router: dirtyRouter } = renderPage();
    const firstName = await screen.findByLabelText(/First name/);
    fireEvent.change(firstName, { target: { value: "Nour" } });
    const cancel = screen.getByRole("button", { name: "Cancel" });
    cancel.focus();
    fireEvent.click(cancel);
    expect(await screen.findByRole("dialog", { name: "Discard unsaved changes?" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    await waitFor(() => expect(cancel).toHaveFocus());
    expect(firstName).toHaveValue("Nour");
    expect(dirtyRouter.state.location.pathname).toBe("/staff/patients/new");
  });

  it("keeps dirty and pending navigations protected, including beforeunload", async () => {
    const pending = createPendingMutationStub(vi.fn());
    vi.mocked(useCreatePatient).mockReturnValue(pending);
    const { router } = renderPage();
    const unload = new Event("beforeunload", { cancelable: true });
    expect(window.dispatchEvent(unload)).toBe(false);
    await act(async () => { await router.navigate("/staff/patients"); });
    expect(await screen.findByRole("dialog", { name: "Discard unsaved changes?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Discard" })).toBeDisabled();
  });

  it("preserves dirty protection after a failed create and sends the exact trimmed payload", async () => {
    const mutateAsync = vi.fn().mockRejectedValue(new Error("Network unavailable"));
    vi.mocked(useCreatePatient).mockReturnValue(createMutationStub(mutateAsync));
    const { router } = renderPage();
    fireEvent.change(await screen.findByLabelText(/First name/), { target: { value: " Nour " } });
    fireEvent.change(screen.getByLabelText(/Last name/), { target: { value: " Haddad " } });
    fireEvent.change(screen.getByLabelText("Phone"), { target: { value: " +963 11 " } });
    fireEvent.click(screen.getByRole("button", { name: "Create patient" }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ first_name: "Nour", last_name: "Haddad", phone_number: "+963 11" })));
    await act(async () => { await router.navigate("/staff/patients"); });
    expect(await screen.findByRole("dialog", { name: "Discard unsaved changes?" })).toBeInTheDocument();
  });

  it("navigates once after a successful resolution even when the mutation is still reported pending", async () => {
    let resolveCreate: (patient: { id: number }) => void = () => undefined;
    const mutateAsync = vi.fn(() => new Promise<{ id: number }>((resolve) => { resolveCreate = resolve; }));
    vi.mocked(useCreatePatient).mockReturnValue(createMutationStub(mutateAsync));
    const { router, rerender } = renderPage();
    fireEvent.change(await screen.findByLabelText(/First name/), { target: { value: "Nour" } });
    fireEvent.change(screen.getByLabelText(/Last name/), { target: { value: "Haddad" } });
    fireEvent.click(screen.getByRole("button", { name: "Create patient" }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    vi.mocked(useCreatePatient).mockReturnValue(createPendingMutationStub(mutateAsync));
    rerender(<RouterProvider router={router} />);
    resolveCreate({ id: 77 });
    await waitFor(() => expect(router.state.location.pathname).toBe("/staff/patients/77"));
    expect(mutateAsync).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog", { name: "Discard unsaved changes?" })).not.toBeInTheDocument();
  });
});
