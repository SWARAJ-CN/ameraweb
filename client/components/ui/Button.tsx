"use client";

import { forwardRef, type ButtonHTMLAttributes, type MouseEvent, type ReactNode } from "react";
import Link from "next/link";
import type { LinkProps } from "next/link";
import { Loader2 } from "lucide-react";
import { Button as HeroButton, buttonVariants, type ButtonProps as HeroButtonProps } from "@heroui/react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

const HERO_VARIANT: Record<
  ButtonVariant,
  "primary" | "secondary" | "outline" | "ghost" | "danger"
> = {
  primary: "primary",
  secondary: "secondary",
  outline: "outline",
  ghost: "ghost",
  danger: "danger",
};

const HERO_SIZE: Record<ButtonSize, "sm" | "md" | "lg"> = {
  sm: "sm",
  md: "md",
  lg: "lg",
  icon: "md",
};

/** Shared classes so links and buttons look identical. */
export function buttonClasses(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string
) {
  return cn(
    buttonVariants({
      variant: HERO_VARIANT[variant],
      size: HERO_SIZE[size],
      isIconOnly: size === "icon",
    }),
    className
  );
}

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "color" | "onClick"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant = "primary",
    size = "md",
    loading = false,
    disabled,
    children,
    onClick,
    ...props
  },
  ref
) {
  return (
    <HeroButton
      ref={ref}
      variant={HERO_VARIANT[variant]}
      size={HERO_SIZE[size]}
      isIconOnly={size === "icon"}
      isDisabled={disabled || loading}
      isPending={loading}
      onPress={onClick ? (event) => onClick(event as unknown as MouseEvent<HTMLButtonElement>) : undefined}
      className={className}
      {...(props as unknown as HeroButtonProps)}
    >
      {loading ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
      {children}
    </HeroButton>
  );
});

export interface ButtonLinkProps extends Omit<LinkProps, "className"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
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
