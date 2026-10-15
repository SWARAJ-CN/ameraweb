"use client";

import Image from "next/image";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/cn";
import { useData } from "@/components/providers/DataProvider";
import { ThemeToggle } from "./ThemeToggle";
import { UserMenu } from "./UserMenu";
import { ServerStatusBadge } from "./ServerStatusBadge";

interface TopbarProps {
  title: string;
  description?: string;
  onOpenMenu: () => void;
}

export function Topbar({ title, description, onOpenMenu }: TopbarProps) {
  const { refresh, refreshing } = useData();

  return (
    <header className="glass sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border px-4 sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="Open navigation"
        className="grid size-9 flex-none place-items-center rounded-lg border border-border bg-surface text-muted-foreground transition-colors duration-150 hover:text-foreground lg:hidden"
      >
        <span className="flex flex-col gap-1">
          <span className="block h-0.5 w-4 rounded-full bg-current" />
          <span className="block h-0.5 w-4 rounded-full bg-current" />
          <span className="block h-0.5 w-4 rounded-full bg-current" />
        </span>
      </button>

      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Image
          src="/logo.jpeg"
          alt=""
          width={28}
          height={28}
          className="size-7 flex-none rounded-lg object-cover lg:hidden"
        />
        <div className="min-w-0">
          <h1 className="truncate text-sm font-bold text-foreground">{title}</h1>
          {description ? (
            <p className="hidden truncate text-[11px] text-muted-foreground sm:block">
              {description}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-none items-center gap-2">
        <ServerStatusBadge />
        <button
          type="button"
          onClick={() => void refresh({ silent: true })}
          disabled={refreshing}
          aria-label="Refresh data"
          title="Refresh data"
          className="grid size-9 place-items-center rounded-lg border border-border bg-surface text-muted-foreground transition-colors duration-150 hover:bg-surface-muted hover:text-foreground disabled:opacity-60"
        >
          <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
        </button>
        <div className="hidden sm:block">
          <ThemeToggle />
        </div>
        <UserMenu />
      </div>
    </header>
  );
}
