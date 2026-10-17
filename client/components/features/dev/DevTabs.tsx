"use client";

import { cn } from "@/lib/cn";

export interface DevTab {
  value: string;
  label: string;
  /** Count shown in a pill beside the label. `null` while it is still loading. */
  count?: number | null;
}

interface DevTabsProps {
  tabs: DevTab[];
  value: string;
  onChange: (value: string) => void;
}

/**
 * Underline tab bar for the developer sections.
 *
 * Deliberately not the pill `SegmentedControl` used elsewhere in the admin:
 * a dev tool reads better with full-width tabs that line up under the repo
 * bar, and the counts give the bar a reason to exist on its own line.
 */
export function DevTabs({ tabs, value, onChange }: DevTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Developer sections"
      className="scrollbar-none sticky top-16 z-20 -mx-4 flex items-stretch gap-0.5 overflow-x-auto border-b border-border bg-background px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
    >
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={cn(
              "relative flex flex-none items-center gap-1.5 px-3 py-3 text-sm font-medium transition-colors duration-150",
              active
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
            {typeof tab.count === "number" ? (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                  active
                    ? "bg-accent-soft text-accent-soft-foreground"
                    : "bg-surface-muted text-muted"
                )}
              >
                {tab.count}
              </span>
            ) : null}
            {active ? (
              <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-accent" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
