import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <section className="page-card">
      <p className="eyebrow">Not found</p>
      <h2>Page not found.</h2>
      <p>This page is unavailable or you may not have permission to view it.</p>
      <Link className="button secondary inline-action" to="/">
        Return home
      </Link>
    </section>
  );
}
