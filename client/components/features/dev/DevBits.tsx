"use client";

import type { ReactNode } from "react";
import {
  buttonClasses,
  type ButtonSize,
  type ButtonVariant,
} from "@/components/ui/Button";

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
