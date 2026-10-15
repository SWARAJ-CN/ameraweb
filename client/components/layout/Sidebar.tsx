"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { NAV_GROUPS } from "./nav-config";
import { cn } from "@/lib/cn";
import { relativeTime } from "@/lib/format";
import { useData } from "@/components/providers/DataProvider";

interface SidebarProps {
  className?: string;
  onNavigate?: () => void;
}

export function Sidebar({ className, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const { settings, refresh, refreshing, lastSyncedAt } = useData();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-e border-border bg-surface",
        className
      )}
    >
      <div className="flex items-center gap-3 border-b border-border px-4 py-4">
        <Image
          src="/logo.jpeg"
          alt="Amare Handmades"
          width={40}
          height={40}
          priority
          className="size-10 flex-none rounded-xl object-cover ring-1 ring-border"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-foreground">
            {settings.shopName || "Amare Handmades"}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            {settings.tagline || "Handmade with Love"}
          </p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto overscroll-contain px-3 py-4">
        <div className="flex flex-col gap-5">
          {NAV_GROUPS.map((group) => (
            <div key={group.title}>
              <p className="px-2 pb-1.5 text-[10px] font-bold tracking-widest text-faint-foreground uppercase">
                {group.title}
              </p>
              <ul className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors duration-150",
                          active
                            ? "bg-brand-soft text-brand"
                            : "text-muted-foreground hover:bg-surface-muted hover:text-foreground"
                        )}
                      >
                        <Icon className="size-4 flex-none" />
                        <span className="truncate">{item.label}</span>
                        {active ? (
                          <span className="absolute inset-y-1.5 -start-3 w-1 rounded-full bg-brand" />
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </nav>

      <div className="border-t border-border px-3 py-3">
        <button
          type="button"
          onClick={() => void refresh({ silent: true })}
          disabled={refreshing}
          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-start text-xs text-muted-foreground transition-colors duration-150 hover:bg-surface-muted hover:text-foreground disabled:opacity-60"
        >
          <RefreshCw className={cn("size-3.5 flex-none", refreshing && "animate-spin")} />
          <span className="truncate">
            {refreshing
              ? "Syncing…"
              : lastSyncedAt
                ? `Synced ${relativeTime(lastSyncedAt)}`
                : "Sync now"}
          </span>
        </button>
      </div>
    </aside>
  );
}
