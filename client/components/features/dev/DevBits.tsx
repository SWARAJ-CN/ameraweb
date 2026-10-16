"use client";

import type { ReactNode } from "react";
import {
  buttonClasses,
  type ButtonSize,
  type ButtonVariant,
} from "@/components/ui/Button";
import { cn } from "@/lib/cn";

interface ExternalButtonProps {
  href: string;
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  title?: string;
}

/** An anchor styled exactly like a Button, for links that leave the app. */
export function ExternalButton({
  href,
  children,
  variant = "outline",
  size = "sm",
  className,
  title,
}: ExternalButtonProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      title={title}
      className={buttonClasses(variant, size, className)}
    >
      {children}
    </a>
  );
}

export function DevStat({
  icon,
  label,
  value,
  className,
}: {
  icon?: ReactNode;
  label: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-border bg-surface-muted px-3 py-2.5", className)}>
      <dt className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-faint-foreground uppercase">
        {icon}
        {label}
      </dt>
      <dd className="mt-0.5 text-sm font-bold text-foreground">{value}</dd>
    </div>
  );
}

export function Meta({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold tracking-wide text-faint-foreground uppercase">
        {label}
      </dt>
      <dd className="mt-0.5 truncate text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}

export function CodeBlock({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <pre
      className={cn(
        "overflow-auto rounded-lg border border-border bg-surface-inset p-3 font-mono text-xs leading-relaxed text-muted-foreground",
        className
      )}
    >
      {children}
    </pre>
  );
}
