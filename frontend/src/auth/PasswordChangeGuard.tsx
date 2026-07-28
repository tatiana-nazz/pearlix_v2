import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuthStore } from "./authStore";

export function PasswordChangeGuard() {
  const location = useLocation();
  const { mustChangePassword } = useAuthStore();
  const isChangePasswordRoute = location.pathname === "/change-password";

  if (mustChangePassword && !isChangePasswordRoute) {
    return <Navigate to="/change-password" replace />;
  }

  return <Outlet />;
}
