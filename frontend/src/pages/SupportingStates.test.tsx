import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import { useAuthStore } from "../auth/authStore";
import { AccessDeniedPage } from "./AccessDeniedPage";
import { NotFoundPage } from "./NotFoundPage";

const user = { id: 7, email: "staff@example.test", full_name: "Maya Staff", role: "STAFF" as const, is_active: true, must_change_password: false, password_changed_at: null, theme_preference: "LIGHT" as const, language_preference: "EN" as const };

afterEach(() => useAuthStore.setState({ accessToken: null, refreshToken: null, user: null, role: null, isAuthenticated: false, authStatus: "anonymous", mustChangePassword: false }));

describe("supporting route states", () => {
  it("returns an unauthorized user to their own dashboard without disclosing the requested route", () => {
    useAuthStore.setState({ user, role: "STAFF", accessToken: "access", isAuthenticated: true, authStatus: "authenticated" });
    render(<MemoryRouter><AccessDeniedPage /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "You do not have access to this page." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Return to my dashboard" })).toHaveAttribute("href", "/staff/dashboard");
    expect(screen.queryByText(/clinic settings/i)).not.toBeInTheDocument();
  });

  it("uses a localized, safe not-found state and returns through the public home route", () => {
    useAuthStore.setState({ user: { ...user, language_preference: "AR" }, role: "STAFF", accessToken: "access", isAuthenticated: true, authStatus: "authenticated" });
    render(<MemoryRouter><NotFoundPage /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "الصفحة غير موجودة." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "العودة للرئيسية" })).toHaveAttribute("href", "/");
    expect(document.querySelector(".supporting-state-page")).toHaveAttribute("dir", "rtl");
  });
});
