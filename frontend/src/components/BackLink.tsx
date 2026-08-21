import type { MouseEventHandler, ReactNode } from "react";
import { Link, type To } from "react-router-dom";

interface BackLinkProps {
  children: ReactNode;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
  to: To;
}

export function BackLink({ children, onClick, to }: BackLinkProps) {
  return (
    <Link className="inline-back-link" to={to} onClick={onClick}>
      <span className="inline-back-link-arrow" aria-hidden="true">←</span>
      <span>{children}</span>
    </Link>
  );
}
