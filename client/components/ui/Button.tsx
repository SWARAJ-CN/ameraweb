"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import Link from "next/link";
import type { LinkProps } from "next/link";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg" | "icon";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-brand text-brand-foreground shadow-sm hover:bg-brand-hover active:bg-brand-active focus-visible:outline-brand-foreground",
  secondary:
    "border border-border bg-surface-muted text-foreground hover:bg-surface-hover active:bg-surface-inset",
  outline:
    "border border-border-strong bg-surface text-foreground hover:bg-surface-muted active:bg-surface-inset",
  ghost:
    "text-muted-foreground hover:bg-surface-muted hover:text-foreground active:bg-surface-inset",
  danger:
    "bg-danger text-white shadow-sm hover:brightness-95 active:brightness-90 focus-visible:outline-white",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 gap-1.5 px-3 text-xs",
  md: "h-10 gap-2 px-4 text-sm",
  lg: "h-11 gap-2 px-5 text-sm",
  icon: "size-10",
};

/** Shared classes so links and buttons look identical. */
export function buttonClasses(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(
    "inline-flex flex-none items-center justify-center rounded-lg font-semibold whitespace-nowrap",
    "transition-colors duration-150 motion-safe:transition-transform active:scale-[0.98]",
    "disabled:pointer-events-none disabled:opacity-55",
    VARIANTS[variant],
    SIZES[size],
    className
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", loading = false, disabled, children, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={buttonClasses(variant, size, className)}
      {...props}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
});

export interface ButtonLinkProps extends LinkProps {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: React.ReactNode;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link className={buttonClasses(variant, size, className)} {...props}>
      {children}
    </Link>
  );
}
