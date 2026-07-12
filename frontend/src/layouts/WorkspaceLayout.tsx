import { useEffect, useRef, useState } from "react";
import { Outlet } from "react-router-dom";

import type { UserRole } from "../types/auth";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { useAuthStore } from "../auth/authStore";

interface WorkspaceLayoutProps {
  role: UserRole;
}

export function WorkspaceLayout({ role }: WorkspaceLayoutProps) {
  const userId = useAuthStore((state) => state.user?.id);
  const language = useAuthStore((state) => state.user?.language_preference ?? "EN");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerTrigger = useRef<HTMLElement | null>(null);
  const storageKey = `pearlix:v2:sidebar:${userId ?? "anonymous"}`;
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(storageKey) === "collapsed");

  useEffect(() => { setCollapsed(localStorage.getItem(storageKey) === "collapsed"); }, [storageKey]);
  useEffect(() => { localStorage.setItem(storageKey, collapsed ? "collapsed" : "expanded"); }, [collapsed, storageKey]);
  useEffect(() => {
    if (!drawerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setDrawerOpen(false); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen]);
  useEffect(() => { if (!drawerOpen) drawerTrigger.current?.focus(); }, [drawerOpen]);

  return (
    <div className="app-shell" data-collapsed={collapsed} data-drawer-open={drawerOpen} dir={language === "AR" ? "rtl" : "ltr"}>
      <Sidebar role={role} collapsed={collapsed} onCollapse={() => setCollapsed((value) => !value)} onNavigate={() => setDrawerOpen(false)} />
      <button aria-label="Close navigation" className="drawer-backdrop" type="button" onClick={() => setDrawerOpen(false)} />
      <div className="app-workspace">
        <Topbar onMenu={(trigger) => { drawerTrigger.current = trigger; setDrawerOpen(true); }} />
        <main className="workspace-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
