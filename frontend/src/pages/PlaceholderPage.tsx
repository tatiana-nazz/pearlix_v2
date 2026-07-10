import type { UserRole } from "../types/auth";
import { roleLabel } from "../utils/roles";

interface PlaceholderPageProps {
  title: string;
  role?: UserRole;
  plannedPhase?: string;
  description?: string;
}

export function PlaceholderPage({ title, role, plannedPhase = "Later Phase 13 implementation", description }: PlaceholderPageProps) {
  return (
    <section className="page-card">
      <p className="eyebrow">{role ? `${roleLabel(role)} route` : "Workspace route"}</p>
      <h2>{title}</h2>
      <dl className="placeholder-meta">
        <div>
          <dt>Required role</dt>
          <dd>{role ? roleLabel(role) : "Authenticated user"}</dd>
        </div>
        <div>
          <dt>Planned phase</dt>
          <dd>{plannedPhase}</dd>
        </div>
      </dl>
      <p>
        {description ??
          "This route is wired for auth, layout, and role-guard QA. The full production workflow is planned for a later phase."}
      </p>
    </section>
  );
}
