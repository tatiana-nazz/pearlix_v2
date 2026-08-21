import { useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuthStore } from "./authStore";

export function AuthGuard() {
  const location = useLocation();
  const { accessToken, authStatus, isAuthenticated, restorationError, loadMe } = useAuthStore();

  useEffect(() => {
    if (accessToken && authStatus === "unknown") {
      void loadMe();
    }
  }, [accessToken, authStatus, loadMe]);

  if (authStatus === "unknown" && accessToken) {
    return <div className="screen-center">Loading workspace...</div>;
  }

  if (authStatus === "restoration_error" && accessToken) {
    return <div className="screen-center" role="alert">
      <p>{restorationError || "The session could not be restored temporarily."}</p>
      <button className="button primary" type="button" onClick={() => void loadMe()}>Retry session restoration</button>
    </div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
