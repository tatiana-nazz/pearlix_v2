import { Link } from "react-router-dom";

import { useAuthStore } from "../auth/authStore";
import { dashboardPathForRole } from "../utils/roles";

export function AccessDeniedPage() {
  const role = useAuthStore((state) => state.role);

  return (
    <section className="page-card">
      <p className="eyebrow">Access denied</p>
      <h2>You do not have access to this page.</h2>
      <p>This workspace is not available to your role. Choose a page from your own workspace navigation.</p>
      <Link className="button primary inline-action" to={dashboardPathForRole(role)}>
        Return to my dashboard
      </Link>
    </section>
  );
}
