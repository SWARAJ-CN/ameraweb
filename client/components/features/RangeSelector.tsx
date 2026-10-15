"use client";

import { CalendarRange } from "lucide-react";
import { RANGE_OPTIONS, type RangeKey } from "@/lib/analytics";
import { cn } from "@/lib/cn";

interface RangeSelectorProps {
  value: RangeKey;
  onChange: (value: RangeKey) => void;
  customStart: string;
  customEnd: string;
  onCustomStartChange: (value: string) => void;
  onCustomEndChange: (value: string) => void;
  className?: string;
}

export function RangeSelector({
  value,
  onChange,
  customStart,
  customEnd,
  onCustomStartChange,
  onCustomEndChange,
  className,
}: RangeSelectorProps) {
  const custom = value === "custom";

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <div className="scrollbar-none max-w-full overflow-x-auto">
        <div
          role="group"
          aria-label="Date range"
          className="inline-flex items-center gap-0.5 rounded-xl border border-border bg-surface-muted p-0.5"
        >
          {RANGE_OPTIONS.map((option) => {
            const selected = value === option.key;
            return (
              <button
                key={option.key}
                type="button"
                aria-pressed={selected}
                onClick={() => onChange(option.key)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors duration-150",
                  selected
                    ? "bg-surface text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {option.label}
              </button>
            );
          })}
          <button
            type="button"
            aria-pressed={custom}
            onClick={() => onChange("custom")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors duration-150",
              custom
                ? "bg-surface text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <CalendarRange className="size-3.5" />
            Custom
          </button>
        </div>
      </div>

      {custom ? (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={customStart}
            max={customEnd || undefined}
            onChange={(event) => onCustomStartChange(event.target.value)}
            aria-label="Start date"
            className="h-9 rounded-lg border border-border bg-surface px-2.5 text-xs text-foreground transition-colors duration-150 hover:border-border-strong focus:border-brand focus:outline-none"
          />
          <span className="text-xs text-faint-foreground">to</span>
          <input
            type="date"
            value={customEnd}
            min={customStart || undefined}
            onChange={(event) => onCustomEndChange(event.target.value)}
            aria-label="End date"
            className="h-9 rounded-lg border border-border bg-surface px-2.5 text-xs text-foreground transition-colors duration-150 hover:border-border-strong focus:border-brand focus:outline-none"
          />
        </div>
      ) : null}
    </div>
  );
}
