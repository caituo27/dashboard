import type { HTMLAttributes } from "react";

/** White rounded card with soft shadow — the Lessie surface. */
export function Card({
  className = "",
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`bg-card border border-line rounded-card shadow-soft ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
