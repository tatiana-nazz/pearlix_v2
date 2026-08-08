import type { ComponentPropsWithoutRef } from "react";
import { SurfaceCard } from "./v2";

type CardProps = ComponentPropsWithoutRef<"section">;

export function Card({ children, className, ...props }: CardProps) {
  return <SurfaceCard {...props} className={["card", className].filter(Boolean).join(" ")}>{children}</SurfaceCard>;
}
