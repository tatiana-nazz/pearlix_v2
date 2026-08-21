import { type FormEvent, useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { useAuthStore } from "../auth/authStore";
import { loginErrorMessage } from "../utils/apiErrors";
import { dashboardPathForRole } from "../utils/roles";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { accessToken, authStatus, isAuthenticated, role, mustChangePassword, restorationError, login, loadMe } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const language = document.documentElement.lang.toLowerCase().startsWith("ar") ? "AR" : "EN";

  useEffect(() => {
    if (accessToken && authStatus === "unknown") {
      void loadMe();
    }
  }, [accessToken, authStatus, loadMe]);

  if (accessToken && authStatus === "unknown") {
    return <div className="screen-center">Restoring session...</div>;
  }

  if (accessToken && authStatus === "restoration_error") {
    return <div className="screen-center" role="alert"><p>{restorationError || "Session restoration is temporarily unavailable."}</p><button className="button primary" type="button" onClick={() => void loadMe()}>Retry</button></div>;
  }

  if (isAuthenticated) {
    return <Navigate to={mustChangePassword ? "/change-password" : safeReturnPath(location.state) ?? dashboardPathForRole(role)} replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError("Email and password are required.");
      return;
    }
    setIsSubmitting(true);
    try {
      const user = await login({ email, password });
      navigate(user.must_change_password ? "/change-password" : safeReturnPath(location.state) ?? dashboardPathForRole(user.role), { replace: true });
    } catch (err) {
      setError(loginErrorMessage(err, language));
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
      {error ? <div className="form-error" role="alert" aria-live="assertive">{error}</div> : null}
      <button className="button primary" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}

export function safeReturnPath(state: unknown): string | null {
  if (!state || typeof state !== "object" || !("from" in state)) return null;
  const from = (state as { from?: unknown }).from;
  if (!from || typeof from !== "object") return null;
  const pathname = String((from as { pathname?: unknown }).pathname ?? "");
  if (!pathname.startsWith("/") || pathname.startsWith("//") || pathname.includes("://")) return null;
  const search = String((from as { search?: unknown }).search ?? "");
  const hash = String((from as { hash?: unknown }).hash ?? "");
  return `${pathname}${search.startsWith("?") ? search : ""}${hash.startsWith("#") ? hash : ""}`;
}
