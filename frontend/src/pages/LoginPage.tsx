import { type FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { useAuthStore } from "../auth/authStore";
import { getErrorMessage } from "../utils/apiErrors";
import { dashboardPathForRole } from "../utils/roles";

export function LoginPage() {
  const navigate = useNavigate();
  const { isAuthenticated, role, mustChangePassword, login } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isAuthenticated) {
    return <Navigate to={mustChangePassword ? "/change-password" : dashboardPathForRole(role)} replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const user = await login({ email, password });
      navigate(user.must_change_password ? "/change-password" : dashboardPathForRole(user.role), { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="form-stack" onSubmit={handleSubmit}>
      <label>
        Email
        <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" required />
      </label>
      <label>
        Password
        <input
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          type="password"
          autoComplete="current-password"
          required
        />
      </label>
      {error ? <div className="form-error">{error}</div> : null}
      <button className="button primary" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
