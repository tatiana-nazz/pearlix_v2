import { useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuthStore } from "./authStore";

export function AuthGuard() {
  const location = useLocation();
  const { accessToken, authStatus, isAuthenticated, loadMe } = useAuthStore();

  useEffect(() => {
    if (accessToken && authStatus === "unknown") {
      void loadMe();
    }
  }, [accessToken, authStatus, loadMe]);

  if (authStatus === "unknown" && accessToken) {
    return <div className="screen-center">Loading workspace...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
