import type { UserRole } from "../types/auth";
import { roleLabel } from "../utils/roles";

interface PlaceholderPageProps {
  title: string;
  role?: UserRole;
  description?: string;
}

export function PlaceholderPage({ title, role, description }: PlaceholderPageProps) {
  return (
    <section className="page-card">
      <p className="eyebrow">{role ? `${roleLabel(role)} route` : "Workspace route"}</p>
      <h2>{title}</h2>
      <p>
        {description ??
          "This route is wired for the frontend foundation. The full production workflow will be implemented in a later phase."}
      </p>
    </section>
  );
}
