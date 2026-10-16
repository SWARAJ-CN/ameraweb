import type { HTMLAttributes, ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle, type LucideIcon } from "lucide-react";
import {
  Alert,
  EmptyState as HeroEmptyState,
  Skeleton as HeroSkeleton,
  Spinner as HeroSpinner,
} from "@heroui/react";
import { cn } from "@/lib/cn";

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <HeroSkeleton className={cn("rounded-md", className)} {...props} />;
}

export function Spinner({ className }: { className?: string }) {
  return <HeroSpinner color="current" className={cn("size-5", className)} />;
}

export function CenteredSpinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <Spinner className="size-6 text-accent" />
      <p className="text-sm text-muted">{label}</p>
    </div>
  );
}

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <HeroEmptyState
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-14 text-center",
        className
      )}
    >
      {icon ? (
        <div className="grid size-12 place-items-center rounded-2xl bg-surface-secondary text-muted">
          {icon}
        </div>
      ) : null}
      <div className="max-w-sm">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description ? (
          <p className="mt-1 text-xs leading-relaxed text-muted">{description}</p>
        ) : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </HeroEmptyState>
  );
}

type NoticeTone = "info" | "success" | "warning" | "danger";

const NOTICE_STATUS: Record<NoticeTone, "accent" | "success" | "warning" | "danger"> = {
  info: "accent",
  success: "success",
  warning: "warning",
  danger: "danger",
};

const NOTICE_ICONS: Record<NoticeTone, LucideIcon> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
};

interface NoticeProps {
  tone?: NoticeTone;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function Notice({ tone = "info", title, children, action, className }: NoticeProps) {
  const Icon = NOTICE_ICONS[tone];
  return (
    <Alert status={NOTICE_STATUS[tone]} className={cn("items-start", className)}>
      <Alert.Indicator>
        <Icon className="size-4" />
      </Alert.Indicator>
      <Alert.Content>
        <Alert.Title>{title}</Alert.Title>
        {children ? (
          <div className="text-sm leading-relaxed text-muted">{children}</div>
        ) : null}
      </Alert.Content>
      {action ? <div className="flex-none">{action}</div> : null}
    </Alert>
  );
}
