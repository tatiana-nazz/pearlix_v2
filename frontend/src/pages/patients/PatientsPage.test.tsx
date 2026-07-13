import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useArchivePatient, useUnarchivePatient } from "../../features/patients/hooks/usePatientMutations";
import { usePatients } from "../../features/patients/hooks/usePatients";
import { PatientsPage } from "./PatientsPage";

vi.mock("../../features/patients/hooks/usePatients", () => ({ usePatients: vi.fn() }));
vi.mock("../../features/patients/hooks/usePatientMutations", () => ({ useArchivePatient: vi.fn(), useUnarchivePatient: vi.fn() }));

const activePatient = { id: 7, first_name: "Nour", last_name: "Haddad", full_name: "Nour Haddad", gender: "Female" as const, date_of_birth: null, age: 28, phone_number: "+963 11", email: "nour@example.test", national_id_or_passport: null, blood_group: "" as const, is_archived: false, version: 4, created_at: "2026-01-01", updated_at: "2026-01-01" };
const archivedPatient = { ...activePatient, id: 8, full_name: "Hadi Haddad", first_name: "Hadi", is_archived: true, version: 5 };
const mutateAsync = vi.fn().mockResolvedValue(activePatient);
const reset = vi.fn();

function Location() { const location = useLocation(); return <output data-testid="location">{location.pathname}{location.search}</output>; }
function renderPage(role: "ADMIN" | "STAFF" | "DOCTOR", entry = "/staff/patients") {
  const path = `/${role.toLowerCase()}/patients`;
  return render(<MemoryRouter initialEntries={[entry]}><Routes><Route path={path} element={<><PatientsPage role={role} /><Location /></>} /><Route path={`${path}/:patientId`} element={<Location />} /></Routes></MemoryRouter>);
}

function mockPatients(results = [activePatient], overrides = {}) {
  vi.mocked(usePatients).mockImplementation(() => ({ data: { count: results.length, next: "/next", previous: null, results }, isLoading: false, isFetching: false, isError: false, error: null, refetch: vi.fn(), ...overrides }) as never);
  vi.mocked(useArchivePatient).mockReturnValue({ mutateAsync, reset, isPending: false, error: null } as never);
  vi.mocked(useUnarchivePatient).mockReturnValue({ mutateAsync, reset, isPending: false, error: null } as never);
}

afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); document.documentElement.lang = "en"; document.documentElement.dir = "ltr"; });

describe("PatientsPage production list, filters, and archive workflow", () => {
  it("shows Add Patient only to Staff and keeps localized, bidi-safe rows free of raw enums", () => {
    mockPatients();
    renderPage("STAFF");
    expect(screen.getByRole("link", { name: "Add Patient" })).toHaveAttribute("href", "/staff/patients/new");
    expect(screen.getByText("Nour Haddad").closest("td")).toHaveClass("bidi-isolate");
    expect(screen.queryByText("Female")).not.toBeInTheDocument();
  });

  it("does not expose Staff creation or archive controls to Admin and Doctor", () => {
    mockPatients();
    const { unmount } = renderPage("ADMIN", "/admin/patients");
    expect(screen.queryByRole("link", { name: "Add Patient" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Archive patient" })).not.toBeInTheDocument();
    unmount();
    renderPage("DOCTOR", "/doctor/patients");
    expect(screen.queryByRole("link", { name: "Add Patient" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Archive patient" })).not.toBeInTheDocument();
  });

  it("maps archive and Doctor workflow filters into production query filters", async () => {
    mockPatients();
    const { unmount } = renderPage("STAFF", "/staff/patients?archive=archived&page=3");
    expect(vi.mocked(usePatients)).toHaveBeenLastCalledWith(expect.objectContaining({ page: 3, is_archived: true }));
    fireEvent.change(screen.getByLabelText("Archive state"), { target: { value: "active" } });
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("page=1"));
    unmount();
    renderPage("DOCTOR", "/doctor/patients?scope=my_patients");
    expect(vi.mocked(usePatients)).toHaveBeenLastCalledWith(expect.objectContaining({ my_patients: true }));
    fireEvent.change(screen.getByLabelText("Patient scope"), { target: { value: "upcoming_with_me" } });
    await waitFor(() => expect(vi.mocked(usePatients)).toHaveBeenLastCalledWith(expect.objectContaining({ upcoming_with_me: true })));
    fireEvent.change(screen.getByLabelText("Patient scope"), { target: { value: "last_visit_with_me" } });
    await waitFor(() => expect(vi.mocked(usePatients)).toHaveBeenLastCalledWith(expect.objectContaining({ last_visit_with_me: true })));
  });

  it("preserves search, filters, and query parameters while paginating and debouncing search", async () => {
    vi.useFakeTimers();
    mockPatients();
    renderPage("STAFF", "/staff/patients?archive=archived&page=2&keep=value");
    fireEvent.change(screen.getByLabelText("Search patients"), { target: { value: "Nour" } });
    await act(async () => { vi.advanceTimersByTime(300); });
    expect(screen.getByTestId("location")).toHaveTextContent("search=Nour");
    expect(screen.getByTestId("location")).toHaveTextContent("archive=archived");
    expect(screen.getByTestId("location")).toHaveTextContent("keep=value");
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByTestId("location")).toHaveTextContent("page=2");
    vi.useRealTimers();
  });

  it("opens profile rows by click, Enter, and Space while nested archive actions stay isolated", async () => {
    mockPatients();
    const { unmount } = renderPage("STAFF");
    const row = screen.getByText("Nour Haddad").closest("tr")!;
    fireEvent.click(row); expect(screen.getByTestId("location")).toHaveTextContent("/patients/7");
    // Re-render the list route for each keyboard assertion.
    unmount();
    mockPatients();
    renderPage("STAFF");
    const keyboardRow = screen.getByText("Nour Haddad").closest("tr")!;
    fireEvent.keyDown(keyboardRow, { key: "Enter" });
    expect(screen.getByTestId("location")).toHaveTextContent("/patients/7");
  });

  it("confirms archive and unarchive with exact id/version payloads and retains an error", async () => {
    mockPatients([activePatient, archivedPatient]);
    renderPage("STAFF");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Archive patient" }));
    await user.click(within(screen.getByRole("dialog", { name: "Archive patient" })).getByRole("button", { name: "Archive patient" }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ id: 7, version: 4 }));
  });
});
