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

describe("Phase 14F production identity, theme, and language controls", () => {
  it("uses explicit LIGHT/DARK toggle and ignores OS changes outside SYSTEM", async () => {
    renderTopbar(); expect(document.documentElement.dataset.theme).toBe("light"); const toggle=screen.getByRole("button", { name:"Theme: Dark" }); fireEvent.click(toggle); await waitFor(() => expect(document.documentElement.dataset.theme).toBe("dark")); listeners.forEach((listener) => listener({ matches:false } as MediaQueryListEvent)); expect(document.documentElement.dataset.theme).toBe("dark"); expect(screen.getAllByText("Nour Haddad").length).toBeGreaterThan(0);
  });
  it("resolves SYSTEM through live matchMedia while preserving a compact accessible description", async () => {
    useAuthStore.setState({ user:{ ...user, theme_preference:"SYSTEM" } }); renderTopbar(); expect(screen.getByRole("button", { name:"Theme: Dark" })).toHaveAttribute("data-tooltip", "System: Light"); act(() => listeners.forEach((listener) => listener({ matches:true } as MediaQueryListEvent))); await waitFor(() => expect(document.documentElement.dataset.theme).toBe("dark"));
  });
  it("switches EN/AR using the production preference flow and applies root direction", async () => {
    renderTopbar(); fireEvent.click(screen.getByRole("button", { name:/AR/ })); await waitFor(() => expect(document.documentElement.lang).toBe("ar")); expect(document.documentElement.dir).toBe("rtl"); expect(screen.getAllByText("Nour Haddad").length).toBeGreaterThan(0); fireEvent.click(screen.getByRole("button", { name:"EN" })); await waitFor(() => expect(document.documentElement.lang).toBe("en"));
  });
});
