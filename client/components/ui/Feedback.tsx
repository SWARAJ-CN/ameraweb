import type { HTMLAttributes, ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("skeleton rounded-md", className)} {...props} />;
}

export function Spinner({ className }: { className?: string }) {
  return (
    <Loader2
      aria-hidden
      className={cn("size-5 animate-spin text-muted-foreground", className)}
    />
  );
}

export function CenteredSpinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <Spinner className="size-6 text-brand" />
      <p className="text-sm text-muted-foreground">{label}</p>
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

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-14 text-center",
        className
      )}
    >
      {icon ? (
        <div className="grid size-12 place-items-center rounded-2xl bg-surface-muted text-faint-foreground">
          {icon}
        </div>
      ) : null}
      <div className="max-w-sm">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description ? (
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

type NoticeTone = "info" | "success" | "warning" | "danger";

const NOTICE_TONES: Record<NoticeTone, { icon: LucideIcon; className: string }> = {
  info: { icon: Info, className: "bg-info-soft text-info" },
  success: { icon: CheckCircle2, className: "bg-success-soft text-success" },
  warning: { icon: AlertTriangle, className: "bg-warning-soft text-warning" },
  danger: { icon: XCircle, className: "bg-danger-soft text-danger" },
};

interface NoticeProps {
  tone?: NoticeTone;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function Notice({ tone = "info", title, children, action, className }: NoticeProps) {
  const { icon: Icon, className: toneClass } = NOTICE_TONES[tone];
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-3 rounded-xl border border-border bg-surface p-3.5",
        className
      )}
    >
      <span className={cn("grid size-8 flex-none place-items-center rounded-lg", toneClass)}>
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {children ? (
          <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{children}</div>
        ) : null}
      </div>
      {action ? <div className="flex-none">{action}</div> : null}
    </div>
  );
}
