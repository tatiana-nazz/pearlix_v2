import { Outlet } from "react-router-dom";

import type { UserRole } from "../types/auth";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

interface WorkspaceLayoutProps {
  role: UserRole;
}

export function WorkspaceLayout({ role }: WorkspaceLayoutProps) {
  return (
    <div className="workspace-shell">
      <Sidebar role={role} />
      <div className="workspace-main">
        <Topbar />
        <main className="content-shell">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
