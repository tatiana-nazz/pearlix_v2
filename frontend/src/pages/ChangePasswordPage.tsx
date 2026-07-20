import { type FormEvent, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { useAuthStore } from "../auth/authStore";
import { getErrorMessage } from "../utils/apiErrors";
import { dashboardPathForRole } from "../utils/roles";

export function ChangePasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { changePassword, logout } = useAuthStore();
  const mustChangePassword = useAuthStore((state) => state.mustChangePassword);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("Current password, new password, and confirmation are required.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation must match.");
      return;
    }
    setIsSubmitting(true);
    try {
      const user = await changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      const from = location.state && typeof location.state === "object" && "from" in location.state && typeof location.state.from === "string" ? location.state.from : null;
      navigate(!mustChangePassword && from ? from : dashboardPathForRole(user.role), { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="form-stack" onSubmit={handleSubmit}>
      <label>
        Current password
        <input
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          type="password"
          autoComplete="current-password"
          required
        />
      </label>
      <label>
        New password
        <input
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          type="password"
          autoComplete="new-password"
          required
        />
      </label>
      <label>
        Confirm new password
        <input
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          type="password"
          autoComplete="new-password"
          required
        />
      </label>
      {error ? <div className="form-error">{error}</div> : null}
      <button className="button primary" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Updating..." : "Change password"}
      </button>
      {!mustChangePassword && location.state && typeof location.state === "object" && "from" in location.state && typeof location.state.from === "string" ? <button className="button secondary" type="button" onClick={() => navigate(location.state.from)} disabled={isSubmitting}>Back</button> : null}
      <button className="button secondary" type="button" onClick={() => void logout()} disabled={isSubmitting}>
        Logout
      </button>
    </form>
  );
}
