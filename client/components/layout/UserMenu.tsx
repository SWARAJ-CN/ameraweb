"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, LogOut, ShieldCheck, User } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";

export function UserMenu() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!user) return null;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-lg border border-border bg-surface p-1 pe-2 transition-colors duration-150 hover:bg-surface-muted"
      >
        <span className="grid size-7 flex-none place-items-center rounded-md bg-brand-soft text-xs font-bold text-brand">
          {initials(user.username)}
        </span>
        <span className="hidden max-w-28 truncate text-xs font-semibold text-foreground sm:block">
          {user.username}
        </span>
        <ChevronDown
          className={cn(
            "size-3.5 text-faint-foreground transition-transform duration-200",
            open ? "rotate-180" : ""
          )}
        />
      </button>

      {open ? (
        <div
          role="menu"
          className="animate-fade absolute end-0 top-full z-40 mt-2 w-56 overflow-clip rounded-xl border border-border bg-surface p-1.5 shadow-pop"
        >
          <div className="px-2.5 py-2">
            <p className="truncate text-sm font-semibold text-foreground">{user.username}</p>
            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground capitalize">
              <ShieldCheck className="size-3" />
              {user.role}
            </p>
          </div>
          <div className="my-1 h-px bg-border" />
          <div className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-muted-foreground">
            <User className="size-3.5" />
            Signed in to Amare admin
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              logout();
              router.replace("/login");
            }}
            className="mt-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-start text-sm font-medium text-danger transition-colors duration-150 hover:bg-danger-soft"
          >
            <LogOut className="size-4" />
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
