"use client";

import { useMemo, useState } from "react";
import type { Slice } from "@/lib/analytics";
import { cn } from "@/lib/cn";

interface DonutChartProps {
  slices: Slice[];
  formatValue: (value: number) => string;
  centerLabel?: string;
  className?: string;
}

const SIZE = 180;
const CENTER = SIZE / 2;
const RADIUS = 68;
const STROKE = 20;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function DonutChart({
  slices,
  formatValue,
  centerLabel = "Total",
  className,
}: DonutChartProps) {
  const [active, setActive] = useState<number | null>(null);

  const total = useMemo(
    () => slices.reduce((sum, slice) => sum + slice.value, 0),
    [slices]
  );

  const segments = useMemo(() => {
    const gap = slices.length > 1 ? 3 : 0;
    const result: Array<Slice & { fraction: number; dash: number; offset: number }> = [];
    let offset = 0;
    for (const slice of slices) {
      const fraction = total > 0 ? slice.value / total : 0;
      const length = fraction * CIRCUMFERENCE;
      result.push({
        ...slice,
        fraction,
        dash: Math.max(0, length - gap),
        offset: -offset,
      });
      offset += length;
    }
    return result;
  }, [slices, total]);

  const activeSlice = active !== null ? segments[active] : null;

  return (
    <div className={cn("flex flex-wrap items-center gap-6", className)}>
      <div className="relative mx-auto flex-none" style={{ width: SIZE, height: SIZE }}>
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          width={SIZE}
          height={SIZE}
          role="img"
          aria-label={`${centerLabel} breakdown`}
        >
          <circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            fill="none"
            stroke="var(--surface-muted)"
            strokeWidth={STROKE}
          />
          <g transform={`rotate(-90 ${CENTER} ${CENTER})`}>
            {segments.map((segment, index) => (
              <circle
                key={segment.label}
                cx={CENTER}
                cy={CENTER}
                r={RADIUS}
                fill="none"
                stroke={segment.color}
                strokeWidth={active === index ? STROKE + 6 : STROKE}
                strokeDasharray={`${segment.dash} ${CIRCUMFERENCE - segment.dash}`}
                strokeDashoffset={segment.offset}
                strokeLinecap="butt"
                opacity={active === null || active === index ? 1 : 0.4}
                className="cursor-pointer transition-opacity duration-150"
                onPointerEnter={() => setActive(index)}
                onPointerLeave={() => setActive(null)}
              />
            ))}
          </g>
        </svg>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[11px] font-medium text-faint-foreground">
            {activeSlice ? activeSlice.label : centerLabel}
          </span>
          <span className="text-lg font-bold tabular-nums text-foreground">
            {formatValue(activeSlice ? activeSlice.value : total)}
          </span>
          {activeSlice ? (
            <span className="text-[11px] font-semibold text-muted-foreground">
              {(activeSlice.fraction * 100).toFixed(1)}%
            </span>
          ) : null}
        </div>
      </div>

      <ul className="flex min-w-0 flex-1 flex-col gap-2">
        {segments.length === 0 ? (
          <li className="text-sm text-muted-foreground">No data for this period.</li>
        ) : null}
        {segments.map((segment, index) => (
          <li
            key={segment.label}
            className={cn(
              "flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 transition-colors duration-150",
              active === index ? "bg-surface-muted" : ""
            )}
            onPointerEnter={() => setActive(index)}
            onPointerLeave={() => setActive(null)}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="size-2.5 flex-none rounded-full"
                style={{ backgroundColor: segment.color }}
              />
              <span className="truncate text-xs font-medium text-foreground">
                {segment.label}
              </span>
            </span>
            <span className="flex flex-none items-center gap-2">
              <span className="text-xs font-semibold tabular-nums text-foreground">
                {formatValue(segment.value)}
              </span>
              <span className="w-10 text-end text-[11px] tabular-nums text-faint-foreground">
                {(segment.fraction * 100).toFixed(0)}%
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
