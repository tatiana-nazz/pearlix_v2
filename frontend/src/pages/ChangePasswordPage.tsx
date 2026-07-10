import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuthStore } from "../auth/authStore";
import { getErrorMessage } from "../utils/apiErrors";
import { dashboardPathForRole } from "../utils/roles";

export function ChangePasswordPage() {
  const navigate = useNavigate();
  const { changePassword } = useAuthStore();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const user = await changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      navigate(dashboardPathForRole(user.role), { replace: true });
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
      {error ? <div className="form-error">{error}</div> : null}
      <button className="button primary" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Updating..." : "Change password"}
      </button>
    </form>
  );
}
