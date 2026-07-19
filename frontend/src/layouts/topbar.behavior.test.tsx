import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authApi } from "../api/endpoints/auth";
import { useAuthStore } from "../auth/authStore";
import type { AuthUser } from "../types/auth";
import { Topbar } from "./Topbar";

const user: AuthUser = { id:7, email:"nour@pearlix.test", full_name:"Nour Haddad", role:"ADMIN", is_active:true, must_change_password:false, password_changed_at:null, theme_preference:"LIGHT", language_preference:"EN" };
let listeners: Array<(event: MediaQueryListEvent) => void> = [];
beforeEach(() => { listeners=[]; window.matchMedia = vi.fn().mockReturnValue({ matches:false, addEventListener:vi.fn((_name:string, listener:(event:MediaQueryListEvent)=>void) => listeners.push(listener)), removeEventListener:vi.fn((_name:string, listener:(event:MediaQueryListEvent)=>void) => { listeners=listeners.filter((item) => item !== listener); }) }); useAuthStore.setState({ user, role:"ADMIN", accessToken:"a", refreshToken:"r", isAuthenticated:true, authStatus:"authenticated", mustChangePassword:false }); vi.spyOn(authApi, "updatePreferences").mockImplementation(async (payload) => ({ ...useAuthStore.getState().user!, ...payload })); });
afterEach(() => { vi.restoreAllMocks(); document.documentElement.dataset.theme=""; document.documentElement.lang="en"; document.documentElement.dir="ltr"; });
function renderTopbar() { return render(<MemoryRouter initialEntries={["/admin/appointments/day"]}><Topbar onMenu={() => undefined} /></MemoryRouter>); }

describe("Phase 14C production theme and language controls", () => {
  it("uses explicit LIGHT/DARK toggle and ignores OS changes outside SYSTEM", async () => {
    renderTopbar(); expect(document.documentElement.dataset.theme).toBe("light"); const toggle=screen.getByRole("button", { name:"Switch to dark mode" }); fireEvent.click(toggle); await waitFor(() => expect(document.documentElement.dataset.theme).toBe("dark")); listeners.forEach((listener) => listener({ matches:false } as MediaQueryListEvent)); expect(document.documentElement.dataset.theme).toBe("dark"); expect(screen.getByText("Nour Haddad")).toBeInTheDocument();
  });
  it("resolves SYSTEM through live matchMedia while preserving a compact accessible description", async () => {
    useAuthStore.setState({ user:{ ...user, theme_preference:"SYSTEM" } }); renderTopbar(); expect(screen.getByRole("button", { name:"Switch to dark mode" })).toHaveAttribute("data-tooltip", "System: light"); act(() => listeners.forEach((listener) => listener({ matches:true } as MediaQueryListEvent))); await waitFor(() => expect(document.documentElement.dataset.theme).toBe("dark"));
  });
  it("uses static bidi-safe identity with one language toggle and applies root direction", async () => {
    renderTopbar(); expect(screen.getByText("Nour Haddad")).toHaveClass("bidi-isolate"); expect(screen.getByText("Admin")).toBeInTheDocument(); expect(document.querySelector("details")).toBeNull(); expect(document.querySelector(".user-avatar")).toBeNull(); expect(screen.getAllByRole("button", { name:/Switch to Arabic/ })).toHaveLength(1); expect(screen.getAllByRole("button", { name:/Switch to dark mode/ })).toHaveLength(1); expect(screen.queryByRole("button", { name:"Logout" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name:"Switch to Arabic" })); await waitFor(() => expect(document.documentElement.lang).toBe("ar")); expect(document.documentElement.dir).toBe("rtl"); expect(screen.getByText("\u0645\u0633\u0624\u0648\u0644")).toBeInTheDocument(); expect(screen.getByRole("button", { name:"\u0627\u0644\u062a\u0628\u062f\u064a\u0644 \u0625\u0644\u0649 \u0627\u0644\u0625\u0646\u062c\u0644\u064a\u0632\u064a\u0629" })).toBeInTheDocument();
  });

  it("keeps a long current-user identity within the intended truncating container", () => {
    useAuthStore.setState({ user:{ ...user, full_name:"Dr Nour Haddad Al-Masri Al-Haddad Al-Karim" } }); renderTopbar(); expect(screen.getByText("Dr Nour Haddad Al-Masri Al-Haddad Al-Karim").closest(".current-user-identity")).not.toBeNull();
  });
});
