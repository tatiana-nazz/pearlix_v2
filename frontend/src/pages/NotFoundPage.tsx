import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <section className="page-card">
      <p className="eyebrow">Not found</p>
      <h2>Page not found.</h2>
      <p>This route is not part of the current frontend foundation, or it may be unavailable to this workspace.</p>
      <Link className="button secondary inline-action" to="/">
        Return home
      </Link>
    </section>
  );
}
