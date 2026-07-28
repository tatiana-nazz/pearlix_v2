import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";

import { RoleGuard } from "../../auth/RoleGuard";
import { useAuthStore } from "../../auth/authStore";
import { WorkspaceLayout } from "../../layouts/WorkspaceLayout";
import type { AuthUser, UserRole } from "../../types/auth";
import { OwnProfilePage } from "./OwnProfilePage";

const user = (role: UserRole, language: "EN" | "AR" = "EN", mustChangePassword = false): AuthUser => ({ id:7, email:"nour@pearlix.test", full_name:"Dr Nour Haddad", role, is_active:true, must_change_password:mustChangePassword, password_changed_at:null, theme_preference:"SYSTEM", language_preference:language });

function renderProfile(role: UserRole) {
  const path = `/${role.toLowerCase()}/profile`;
  const router = createMemoryRouter([{ path:`/${role.toLowerCase()}`, element:<RoleGuard roles={[role]}><WorkspaceLayout role={role} /></RoleGuard>, children:[{ path:"profile", element:<OwnProfilePage /> }] }], { initialEntries:[path] });
  return render(<RouterProvider router={router} />);
}

describe("OwnProfilePage", () => {
  beforeEach(() => { useAuthStore.setState({ user:user("ADMIN"), role:"ADMIN", accessToken:"a", refreshToken:"r", isAuthenticated:true, authStatus:"authenticated", mustChangePassword:false }); });

  it("renders role-aware profile tabs and identity through every workspace guard", () => {
    for (const role of ["ADMIN", "STAFF", "DOCTOR"] as const) {
      useAuthStore.setState({ user:user(role), role });
      const view = renderProfile(role);
      expect(screen.getByRole("heading", { name:"My profile" })).toBeInTheDocument();
      expect(screen.getAllByText("Dr Nour Haddad").some((element) => element.tagName === "DD" && element.classList.contains("bidi-isolate"))).toBe(true);
      expect(screen.getByText("nour@pearlix.test").closest("bdi")).not.toBeNull();
      expect(screen.getByText("System")).toBeInTheDocument();
      expect(screen.getByText("Password current")).toBeInTheDocument();
      expect(screen.getByRole("link", { name:"Personal Information" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name:"Security" })).toBeInTheDocument();
      if (role === "ADMIN") {
        expect(screen.queryByRole("link", { name:"Schedule" })).not.toBeInTheDocument();
      } else {
        expect(screen.getByRole("link", { name:"Schedule" })).toHaveAttribute("href", `/${role.toLowerCase()}/profile?tab=schedule`);
        expect(screen.getByRole("link", { name:"Leave" })).toBeInTheDocument();
      }
      view.unmount();
    }
  });

  it("represents the available password-change requirement and Arabic identity safely", () => {
    useAuthStore.setState({ user:user("DOCTOR", "AR", true), role:"DOCTOR", mustChangePassword:true });
    render(<RouterProvider router={createMemoryRouter([{ path:"/doctor/profile", element:<OwnProfilePage /> }], { initialEntries:["/doctor/profile"] })} />);
    expect(screen.getByText("\u064a\u062c\u0628 \u062a\u063a\u064a\u064a\u0631 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631")).toBeInTheDocument();
    expect(screen.getByText("nour@pearlix.test").closest("bdi")).not.toBeNull();
  });
});
