"use client";

import { useRouter } from "next/navigation";
import { ChevronDown, LogOut, ShieldCheck, User } from "lucide-react";
import { Dropdown } from "@heroui/react";
import { useAuth } from "@/components/providers/AuthProvider";
import { initials } from "@/lib/format";

export function UserMenu() {
  const { user, logout } = useAuth();
  const router = useRouter();

  if (!user) return null;

  return (
    <Dropdown>
      <Dropdown.Trigger
        aria-label="Account menu"
        className="flex h-9 items-center gap-2 rounded-field bg-surface px-1 pe-2 text-foreground shadow-field"
      >
        <span className="grid size-7 flex-none place-items-center rounded-[calc(var(--radius-field)-4px)] bg-accent-soft text-xs font-bold text-accent-soft-foreground">
          {initials(user.username)}
        </span>
        <span className="hidden max-w-28 truncate text-xs font-semibold sm:block">
          {user.username}
        </span>
        <ChevronDown className="size-3.5 text-muted" />
      </Dropdown.Trigger>

      <Dropdown.Popover placement="bottom end">
        <Dropdown.Menu
          onAction={(key) => {
            if (key === "logout") {
              logout();
              router.replace("/login");
            }
          }}
        >
          <Dropdown.Section>
            <div className="px-2.5 py-2">
              <p className="truncate text-sm font-semibold text-foreground">{user.username}</p>
              <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted capitalize">
                <ShieldCheck className="size-3" />
                {user.role}
              </p>
            </div>
            <div className="flex items-center gap-2 px-2.5 py-2 text-xs text-muted">
              <User className="size-3.5" />
              Signed in to Amare admin
            </div>
          </Dropdown.Section>
          <Dropdown.Item id="logout" variant="danger">
            <LogOut className="size-4" />
            Sign out
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
