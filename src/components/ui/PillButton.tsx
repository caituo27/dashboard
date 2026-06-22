import type { ButtonHTMLAttributes } from "react";

type Variant = "solid" | "outline";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

/** Black (or outlined) rounded-pill button — the core Lessie CTA. */
export function PillButton({
  variant = "solid",
  className = "",
  children,
  ...rest
}: Props) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-full font-medium " +
    "transition-all duration-150 hover:-translate-y-0.5 disabled:opacity-55 " +
    "disabled:cursor-not-allowed disabled:hover:translate-y-0";
  const variants: Record<Variant, string> = {
    solid: "bg-pill text-white px-7 py-3 text-[15px]",
    outline:
      "border border-line bg-[#fafafa] text-ink px-4 py-2 text-[13px] hover:bg-[#f0f0ef]",
  };
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...rest}>
      {children}
    </button>
  );
}
