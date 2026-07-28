import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "../../auth/authStore";
import { usePatients } from "../../features/patients/hooks/usePatients";
import { PatientsPage } from "./PatientsPage";

vi.mock("../../features/patients/hooks/usePatients", () => ({ usePatients: vi.fn() }));

const activePatient = { id: 7, first_name: "Nour", last_name: "Haddad", full_name: "Nour Haddad", gender: "Female" as const, date_of_birth: null, age: 28, phone_number: "+963 11", email: "nour@example.test", national_id_or_passport: null, blood_group: "" as const, is_archived: false, version: 4, created_at: "2026-01-01", updated_at: "2026-01-01" };
function Location() { const location = useLocation(); return <output data-testid="location">{location.pathname}{location.search}</output>; }
function renderPage(role: "ADMIN" | "STAFF" | "DOCTOR", entry = "/staff/patients") {
  const path = `/${role.toLowerCase()}/patients`;
  return render(<MemoryRouter initialEntries={[entry]}><Routes><Route path={path} element={<><PatientsPage role={role} /><Location /></>} /><Route path={`${path}/:patientId`} element={<Location />} /></Routes></MemoryRouter>);
}
function mockPatients(results = [activePatient], overrides = {}) {
  const refetch = vi.fn();
  vi.mocked(usePatients).mockImplementation(() => ({ data: { count: results.length, next: null, previous: null, results }, isLoading: false, isFetching: false, isError: false, error: null, refetch, ...overrides }) as never);
  return refetch;
}

afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); useAuthStore.setState({ user: null, role: null }); document.documentElement.lang = "en"; document.documentElement.dir = "ltr"; });

describe("PatientsPage", () => {
  it("uses URL-backed supported archive and doctor workflow filters and preserves pagination", () => {
    mockPatients();
    const { unmount } = renderPage("STAFF", "/staff/patients?search=nour&archive=archived&page=3");
    expect(vi.mocked(usePatients)).toHaveBeenLastCalledWith(expect.objectContaining({ search: "nour", is_archived: true, page: 3 }));
    fireEvent.change(screen.getByLabelText("Archive state"), { target: { value: "active" } });
    expect(screen.getByTestId("location")).toHaveTextContent("search=nour&page=1");
    unmount();
    renderPage("DOCTOR", "/doctor/patients?scope=upcoming_with_me&page=2");
    expect(vi.mocked(usePatients)).toHaveBeenLastCalledWith(expect.objectContaining({ upcoming_with_me: true, page: 2 }));
    fireEvent.change(screen.getByLabelText("Patient scope"), { target: { value: "last_visit_with_me" } });
    expect(screen.getByTestId("location")).toHaveTextContent("scope=last_visit_with_me&page=1");
  });

  it("debounces server search, resets page, and clears active filters", async () => {
    vi.useFakeTimers();
    mockPatients();
    renderPage("STAFF", "/staff/patients?archive=archived&page=3");
    fireEvent.change(screen.getByLabelText("Search patients"), { target: { value: "Nour" } });
    expect(screen.getByTestId("location")).toHaveTextContent("archive=archived&page=3");
    act(() => vi.advanceTimersByTime(300));
    expect(screen.getByTestId("location")).toHaveTextContent("archive=archived&page=1&search=Nour");
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByTestId("location")).toHaveTextContent("page=1");
  });

  it("keeps list actions out of every role while retaining Staff creation", () => {
    mockPatients();
    const staff = renderPage("STAFF");
    expect(screen.getByRole("link", { name: "Add Patient" })).toHaveAttribute("href", "/staff/patients/new");
    expect(screen.queryByRole("button", { name: /archive|unarchive|edit|view/i })).not.toBeInTheDocument();
    staff.unmount();
    renderPage("ADMIN", "/admin/patients");
    expect(screen.queryByRole("link", { name: "Add Patient" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /archive|unarchive|edit|view/i })).not.toBeInTheDocument();
  });

  it("renders loading, refreshing, distinct empty states, and retryable errors", () => {
    mockPatients([], { isLoading: true, data: undefined });
    const loading = renderPage("STAFF");
    expect(screen.getByText("Loading patients…")).toBeInTheDocument();
    loading.unmount();
    mockPatients([], { isFetching: true });
    const refreshing = renderPage("STAFF");
    expect(screen.getByText("Refreshing patient results…")).toHaveAttribute("role", "status");
    refreshing.unmount();
    mockPatients([]);
    const empty = renderPage("STAFF");
    expect(screen.getByText("No patient records yet.")).toBeInTheDocument();
    empty.unmount();
    mockPatients([]);
    const noMatch = renderPage("STAFF", "/staff/patients?search=nope");
    expect(screen.getByText("No patients match the current search or filters.")).toBeInTheDocument();
    noMatch.unmount();
    const retry = mockPatients([], { data: undefined, isError: true, error: new Error("Unavailable") });
    renderPage("STAFF");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("uses the table scroll surface and localized Arabic copy without exposing raw values", () => {
    document.documentElement.lang = "ar";
    document.documentElement.dir = "rtl";
    useAuthStore.setState({ user: { language_preference: "AR" } as never, role: "STAFF" });
    mockPatients([{ ...activePatient, full_name: "ليلى Haddad", email: "" }]);
    renderPage("STAFF");
    expect(document.documentElement).toHaveAttribute("dir", "rtl");
    expect(screen.getByText("ليلى Haddad")).toHaveClass("bidi-isolate");
    expect(screen.queryByText("Female")).not.toBeInTheDocument();
    expect(document.querySelector(".v2-table-scroll")).not.toBeNull();
  });
});
