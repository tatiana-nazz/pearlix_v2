import type { PropsWithChildren } from "react";
import { SurfaceCard } from "./v2";

type CardProps = PropsWithChildren<{
  className?: string;
}>;

export function Card({ children, className }: CardProps) {
  return <SurfaceCard className={["card", className].filter(Boolean).join(" ")}>{children}</SurfaceCard>;
}
