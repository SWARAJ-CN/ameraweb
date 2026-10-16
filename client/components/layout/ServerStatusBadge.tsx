"use client";

import Link from "next/link";
import { Chip } from "@heroui/react";
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

const COLORS: Record<string, "success" | "danger" | "warning"> = {
  checking: "warning",
  online: "success",
  offline: "danger",
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
      aria-label={title}
      className={cn("inline-flex flex-none items-center", className)}
    >
      <Chip color={COLORS[state]} variant="soft" size="sm">
        <Chip.Label className="inline-flex items-center gap-2">
          <span className="relative flex size-2 flex-none">
            {state === "checking" ? (
              <span className="absolute inline-flex size-2 animate-ping rounded-full bg-warning opacity-70" />
            ) : null}
            <span className={cn("relative inline-flex size-2 rounded-full", DOTS[state])} />
          </span>
          <span className="hidden text-xs font-semibold sm:inline">{LABELS[state]}</span>
          {state === "online" && latencyMs !== null ? (
            <span className="hidden text-[11px] tabular-nums opacity-70 md:inline">
              {latencyMs}ms
            </span>
          ) : null}
        </Chip.Label>
      </Chip>
    </Link>
  );
}
