"use client";

import Link from "next/link";
import { useServerStatus } from "@/components/providers/ServerStatusProvider";
import { cn } from "@/lib/cn";

const LABELS: Record<string, string> = {
  checking: "Checking",
  online: "Online",
  offline: "Offline",
};

const DOTS: Record<string, string> = {
  checking: "bg-warning",
  online: "bg-success",
  offline: "bg-danger",
};

export function ServerStatusBadge({ className }: { className?: string }) {
  const { state, latencyMs } = useServerStatus();

  const title =
    state === "online"
      ? `Server online${latencyMs !== null ? ` · ${latencyMs}ms` : ""}`
      : state === "offline"
      ? "Server unreachable"
      : "Checking server…";

  return (
    <Link
      href="/server"
      title={title}
      className={cn(
        "inline-flex h-9 flex-none items-center gap-2 rounded-lg border border-border bg-surface px-2.5 text-muted-foreground transition-colors duration-150 hover:bg-surface-muted hover:text-foreground",
        className
      )}
    >
      <span className="relative flex size-2 flex-none">
        {state === "checking" ? (
          <span className="absolute inline-flex size-2 animate-ping rounded-full bg-warning opacity-70" />
        ) : null}
        <span className={cn("relative inline-flex size-2 rounded-full", DOTS[state])} />
      </span>
      <span className="hidden text-xs font-semibold sm:inline">{LABELS[state]}</span>
      {state === "online" && latencyMs !== null ? (
        <span className="hidden text-[11px] tabular-nums text-faint-foreground md:inline">
          {latencyMs}ms
        </span>
      ) : null}
    </Link>
  );
}
