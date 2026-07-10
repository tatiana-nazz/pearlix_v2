import type { PropsWithChildren } from "react";
import { Navigate } from "react-router-dom";

import type { UserRole } from "../types/auth";
import { useAuthStore } from "./authStore";

interface RoleGuardProps extends PropsWithChildren {
  roles: UserRole[];
}

export function RoleGuard({ roles, children }: RoleGuardProps) {
  const role = useAuthStore((state) => state.role);

  if (!role || !roles.includes(role)) {
    return <Navigate to="/access-denied" replace />;
  }

  return <>{children}</>;
}
