import { useNavigate } from "react-router-dom";

import { useAuthStore } from "../auth/authStore";
import { dashboardPathForRole } from "../utils/roles";
import { ChangePasswordForm } from "../components/ChangePasswordForm";

export function ChangePasswordPage() {
  const navigate = useNavigate();
  return <ChangePasswordForm standalone onSuccess={() => {
    const role = useAuthStore.getState().user?.role;
    navigate(dashboardPathForRole(role), { replace: true });
  }} />;
}
