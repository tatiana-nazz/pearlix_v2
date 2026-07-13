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
globalThis.Request = JsdomRequest as never;

vi.mock("../../features/patients/hooks/usePatientMutations", () => ({ useCreatePatient: vi.fn() }));
vi.mock("../../features/patients/components/PatientForm", () => ({
  createPayloadFromForm: (value: unknown) => value,
  PatientForm: ({ onDirtyChange, onSubmit }: { onDirtyChange: (dirty: boolean) => void; onSubmit: (values: { first_name: string }) => Promise<void> }) => <><button type="button" onClick={() => onDirtyChange(true)}>Change patient</button><button type="button" onClick={() => void onSubmit({ first_name: "Nour" })}>Create patient</button></>,
}));

function renderPage() {
  const router = createMemoryRouter([
    { path: "/staff/patients/new", element: <NewPatientPage role="STAFF" /> },
    { path: "/staff/patients/:patientId", element: <p>Patient profile</p> },
    { path: "/staff/patients", element: <p>Patient list</p> },
  ], { initialEntries: ["/staff/patients/new"] });
  render(<RouterProvider router={router} />);
  return router;
}

describe("New patient production route", () => {
  it("allows the successful create navigation through the blocker after a dirty form", async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ id: 42 });
    vi.mocked(useCreatePatient).mockReturnValue({ mutateAsync, isPending: false, error: null } as never);
    const router = renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Change patient" }));
    fireEvent.click(screen.getByRole("button", { name: "Create patient" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/staff/patients/42"));
    expect(screen.getByText("Patient profile")).toBeInTheDocument();
    expect(mutateAsync).toHaveBeenCalledTimes(1);
  });

  it("blocks ordinary route navigation until the user discards the changed form", async () => {
    vi.mocked(useCreatePatient).mockReturnValue({ mutateAsync: vi.fn(), isPending: false, error: null } as never);
    const router = renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Change patient" }));
    await act(async () => { await router.navigate("/staff/patients"); });
    expect(await screen.findByRole("dialog", { name: "Discard unsaved changes?" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/staff/patients"));
  });
});
