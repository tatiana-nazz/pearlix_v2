import { Navigate, Outlet, useLocation } from "react-router-dom";

import { dashboardPathForRole } from "../utils/roles";
import { useAuthStore } from "./authStore";

export function PasswordChangeGuard() {
  const location = useLocation();
  const { mustChangePassword, role } = useAuthStore();
  const isChangePasswordRoute = location.pathname === "/change-password";

  if (mustChangePassword && !isChangePasswordRoute) {
    return <Navigate to="/change-password" replace />;
  }

  if (!mustChangePassword && isChangePasswordRoute) {
    return <Navigate to={dashboardPathForRole(role)} replace />;
  }

  return <Outlet />;
}
