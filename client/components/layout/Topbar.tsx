"use client";

import Image from "next/image";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/cn";
import { useData } from "@/components/providers/DataProvider";
import { Button } from "@/components/ui/Button";
import { ThemeToggle } from "./ThemeToggle";
import { UserMenu } from "./UserMenu";
import { ServerStatusBadge } from "./ServerStatusBadge";
import { VoiceCommand } from "./VoiceCommand";

interface TopbarProps {
  title: string;
  description?: string;
  onOpenMenu: () => void;
}

export function Topbar({ title, description, onOpenMenu }: TopbarProps) {
  const { refresh, refreshing } = useData();

  return (
    <header className="glass sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-separator px-4 sm:px-6 lg:px-8">
      <Button
        size="icon"
        variant="secondary"
        onClick={onOpenMenu}
        aria-label="Open navigation"
        className="lg:hidden"
      >
        <span className="flex flex-col gap-1">
          <span className="block h-0.5 w-4 rounded-full bg-current" />
          <span className="block h-0.5 w-4 rounded-full bg-current" />
          <span className="block h-0.5 w-4 rounded-full bg-current" />
        </span>
      </Button>

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
            <p className="hidden truncate text-[11px] text-muted sm:block">{description}</p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-none items-center gap-2">
        <ServerStatusBadge />
        <Button
          size="icon"
          variant="secondary"
          onClick={() => void refresh({ silent: true })}
          disabled={refreshing}
          aria-label="Refresh data"
          title="Refresh data"
        >
          <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
        </Button>
        <VoiceCommand />
        <div className="hidden sm:block">
          <ThemeToggle />
        </div>
        <UserMenu />
      </div>
    </header>
  );
}
