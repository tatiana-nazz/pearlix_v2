import { NavLink } from "react-router-dom";
import { ChevronLeft, ChevronRight, LogOut, X } from "lucide-react";

import type { UserRole } from "../types/auth";
import { useAuthStore } from "../auth/authStore";
import { navigationByRole, type NavigationGroup } from "./navigation";
import { roleT, t, workspaceT } from "./i18n";
export { navigationByRole } from "./navigation";

interface SidebarProps {
  role: UserRole;
  collapsed?: boolean;
  onCollapse?: () => void;
  onNavigate?: () => void;
  onLogout?: () => void;
  drawerOpen?: boolean;
  onDrawerClose?: () => void;
}

export function Sidebar({ role, collapsed = false, drawerOpen = false, onDrawerClose = () => undefined, onCollapse = () => undefined, onNavigate = () => undefined, onLogout = () => undefined }: SidebarProps) {
  const groups: NavigationGroup[] = ["workspace", "clinical", "administration", "personal"];
  const language = useAuthStore((state) => state.user?.language_preference ?? "EN");
  return (
    <aside className="app-sidebar">
      <div className="app-sidebar-brand">
        <div className="app-sidebar-brand-mark">P</div>
        <div className="app-sidebar-brand-copy">
          <strong>Pearlix</strong>
          <span>{workspaceT(language, role)}</span>
        </div>{drawerOpen ? <button className="v2-icon-button drawer-close" type="button" aria-label={t(language, "close")} onClick={onDrawerClose}><X size={20} /></button> : null}<button className="v2-icon-button sidebar-toggle sidebar-toggle-simple" type="button" aria-label={collapsed ? t(language, "expandSidebar") : t(language, "collapseSidebar")} data-tooltip={collapsed ? t(language, "expandSidebar") : t(language, "collapseSidebar")} onClick={onCollapse}>{collapsed ? <ChevronRight className="directional-icon" size={22} /> : <ChevronLeft className="directional-icon" size={22} />}</button>
      </div>
      <nav className="app-sidebar-nav" aria-label={`${roleT(language, role)} ${t(language, "navigation")}`}>
        {groups.map((group) => {
          const items = navigationByRole[role].filter((item) => item.group === group);
          if (!items.length) return null;
          return <section className="nav-group" key={group}><h2 className="nav-group-label">{t(language, group)}</h2>{items.map((item) => { const Icon = item.icon; const label = t(language, item.labelKey); return <NavLink key={item.path} to={item.path} onClick={onNavigate} aria-label={label} className={({ isActive }) => isActive ? "v2-nav-link active" : "v2-nav-link"}><Icon aria-hidden="true" size={collapsed ? 22 : 20} strokeWidth={1.75} /><span className="nav-label">{label}</span></NavLink>; })}</section>;
        })}
      </nav>
      <footer className="app-sidebar-footer"><button className="sidebar-logout" type="button" aria-label={t(language, "logout")} data-tooltip={t(language, "logout")} onClick={onLogout}><LogOut size={20} aria-hidden="true" /><span className="nav-label">{t(language, "logout")}</span></button></footer>
    </aside>
  );
}
