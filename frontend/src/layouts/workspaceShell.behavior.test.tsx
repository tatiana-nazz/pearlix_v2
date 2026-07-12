import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useAuthStore } from "../auth/authStore";
import type { AuthUser } from "../types/auth";
import { WorkspaceLayout } from "./WorkspaceLayout";

const user = (id:number): AuthUser => ({ id, email:`u${id}@test.local`, full_name:"Nour Haddad", role:"ADMIN", is_active:true, must_change_password:false, password_changed_at:null, theme_preference:"LIGHT", language_preference:"EN" });
function renderShell() { const router = createMemoryRouter([{ element:<WorkspaceLayout role="ADMIN" />, children:[{ path:"/admin/dashboard", element:<p>Dashboard body</p> }] }], { initialEntries:["/admin/dashboard"] }); return render(<RouterProvider router={router} />); }

describe("Phase 14C production workspace shell", () => {
  beforeEach(() => { localStorage.clear(); useAuthStore.setState({ user:user(1), role:"ADMIN", accessToken:"a", refreshToken:"r", isAuthenticated:true, authStatus:"authenticated", mustChangePassword:false }); });
  afterEach(() => { localStorage.clear(); document.documentElement.lang="en"; document.documentElement.dir="ltr"; });
  it("persists collapse per authenticated user and restores it on remount", () => {
    const { unmount } = renderShell(); const shell = document.querySelector(".app-shell")!;
    expect(shell).toHaveAttribute("data-collapsed", "false"); fireEvent.click(screen.getByRole("button", { name:"Collapse sidebar" })); expect(shell).toHaveAttribute("data-collapsed", "true"); expect(localStorage.getItem("pearlix:v2:sidebar:1")).toBe("collapsed"); unmount();
    useAuthStore.setState({ user:user(2) }); renderShell(); expect(document.querySelector(".app-shell")).toHaveAttribute("data-collapsed", "false");
  });
  it("opens and closes production drawer controls while retaining logout and the Admin Team link", () => {
    renderShell(); const opener = screen.getByRole("button", { name:"Open navigation" }); opener.focus(); fireEvent.click(opener); expect(document.querySelector(".app-shell")).toHaveAttribute("data-drawer-open", "true"); expect(document.querySelector(".drawer-close")).toBeInTheDocument(); expect(screen.getAllByRole("button", { name:"Logout" }).some((item) => item.classList.contains("sidebar-logout"))).toBe(true); expect(screen.getAllByRole("link", { name:"Team" })[0]).toHaveAttribute("href", "/admin/team"); fireEvent.keyDown(document, { key:"Escape" }); expect(document.querySelector(".app-shell")).toHaveAttribute("data-drawer-open", "false");
  });
  it("uses top-only compact control, logical RTL direction, and no horizontal sidebar overflow contract", async () => {
    renderShell(); const shell = document.querySelector(".app-shell")!; useAuthStore.setState({ user:{ ...user(1), language_preference:"AR" } }); await waitFor(() => expect(shell).toHaveAttribute("dir", "rtl")); expect(document.querySelectorAll(".app-sidebar .sidebar-toggle")).toHaveLength(1); expect(document.querySelector(".app-sidebar-footer .sidebar-toggle")).toBeNull(); expect(document.querySelector(".app-sidebar")).toHaveClass("app-sidebar");
  });
});
