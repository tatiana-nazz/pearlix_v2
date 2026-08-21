import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

import type { UserRole } from "../types/auth";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { useAuthStore } from "../auth/authStore";
import { t } from "./i18n";
import { pageTitle } from "./pageMetadata";

interface WorkspaceLayoutProps {
  role: UserRole;
}

export function WorkspaceLayout({ role }: WorkspaceLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const logout = useAuthStore((state) => state.logout);
  const userId = useAuthStore((state) => state.user?.id);
  const language = useAuthStore((state) => state.user?.language_preference ?? "EN");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerTrigger = useRef<HTMLElement | null>(null);
  const shell = useRef<HTMLDivElement>(null);
  const storageKey = `pearlix:v2:sidebar:${userId ?? "anonymous"}`;
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(storageKey) === "collapsed");

  useEffect(() => { setCollapsed(localStorage.getItem(storageKey) === "collapsed"); }, [storageKey]);
  useEffect(() => { localStorage.setItem(storageKey, collapsed ? "collapsed" : "expanded"); }, [collapsed, storageKey]);
  useEffect(() => { document.title = `${pageTitle(location.pathname, language)} · Pearlix`; }, [language, location.pathname]);
  useEffect(() => {
    if (!drawerOpen) return;
    const sidebar = shell.current?.querySelector<HTMLElement>(".app-sidebar");
    const workspace = shell.current?.querySelector<HTMLElement>(".app-workspace");
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (workspace) workspace.inert = true;
    window.setTimeout(() => sidebar?.querySelector<HTMLElement>(".drawer-close, a, button")?.focus(), 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setDrawerOpen(false); return; }
      if (event.key !== "Tab" || !sidebar) return;
      const focusable = Array.from(sidebar.querySelectorAll<HTMLElement>("a[href], button:not(:disabled), [tabindex]:not([tabindex='-1'])"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (workspace) workspace.inert = false;
    };
  }, [drawerOpen]);
  useEffect(() => { if (!drawerOpen) drawerTrigger.current?.focus(); }, [drawerOpen]);

  return (
    <div ref={shell} className="app-shell" data-collapsed={collapsed} data-drawer-open={drawerOpen} dir={language === "AR" ? "rtl" : "ltr"}>
      <a className="skip-link" href="#main-content">{language === "AR" ? "الانتقال إلى المحتوى الرئيسي" : "Skip to main content"}</a>
      <Sidebar role={role} collapsed={collapsed} drawerOpen={drawerOpen} onDrawerClose={() => setDrawerOpen(false)} onCollapse={() => setCollapsed((value) => !value)} onNavigate={() => setDrawerOpen(false)} onLogout={() => void logout().then(() => navigate("/login", { replace: true }))} />
      <button aria-label={t(language, "close")} className="drawer-backdrop" type="button" onClick={() => setDrawerOpen(false)} />
      <div className="app-workspace">
        <Topbar onMenu={(trigger) => { drawerTrigger.current = trigger; setDrawerOpen(true); }} />
        <main id="main-content" className="workspace-content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
