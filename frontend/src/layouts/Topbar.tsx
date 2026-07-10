import { useNavigate } from "react-router-dom";

import { useAuthStore } from "../auth/authStore";
import { roleLabel } from "../utils/roles";

export function Topbar() {
  const navigate = useNavigate();
  const { user, role, logout } = useAuthStore();

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">{roleLabel(role)} workspace</p>
        <h1>{user?.full_name ?? "Pearlix"}</h1>
      </div>
      <button className="button secondary" type="button" onClick={handleLogout}>
        Logout
      </button>
    </header>
  );
}
