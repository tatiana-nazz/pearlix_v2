import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiClientError } from "../api/errors";
import { useAuthStore } from "../auth/authStore";
import { LoginPage, safeReturnPath } from "./LoginPage";

const originalState = useAuthStore.getState();

afterEach(() => {
  useAuthStore.setState(originalState, true);
  document.documentElement.lang = "en";
});

function renderLogin(login: ReturnType<typeof vi.fn>) {
  useAuthStore.setState({ accessToken: null, authStatus: "anonymous", isAuthenticated: false, role: null, mustChangePassword: false, login });
  render(<MemoryRouter><LoginPage /></MemoryRouter>);
}

describe("LoginPage", () => {
  it("accepts only internal deep-link return destinations", () => {
    expect(safeReturnPath({ from: { pathname: "/doctor/patients/123", search: "?tab=medical", hash: "#summary" } })).toBe("/doctor/patients/123?tab=medical#summary");
    expect(safeReturnPath({ from: { pathname: "//evil.example/path" } })).toBeNull();
    expect(safeReturnPath({ from: { pathname: "https://evil.example" } })).toBeNull();
  });
  it("announces an unavailable-service message instead of the raw network error", async () => {
    renderLogin(vi.fn().mockRejectedValue(new ApiClientError({ code: "NETWORK_ERROR", message: "Network request failed.", details: {}, status: 0 })));
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "staff@example.test" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("service is unavailable");
  });

  it("announces Arabic disabled-account copy when the document language is Arabic", async () => {
    document.documentElement.lang = "ar";
    renderLogin(vi.fn().mockRejectedValue(new ApiClientError({ code: "ACCOUNT_DISABLED", message: "Request failed.", details: {}, status: 401 })));
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "staff@example.test" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("هذا الحساب معطّل");
  });
});
