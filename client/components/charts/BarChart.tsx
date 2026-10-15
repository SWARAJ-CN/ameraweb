"use client";

import { useMemo, useState } from "react";
import { axisTicks, niceMax } from "@/lib/analytics";
import { cn } from "@/lib/cn";
import { labelIndices } from "./chart-utils";

export interface BarSeries {
  name: string;
  color: string;
  values: number[];
}

interface BarChartProps {
  labels: string[];
  fullLabels?: string[];
  series: BarSeries[];
  formatValue: (value: number) => string;
  formatAxis?: (value: number) => string;
  className?: string;
}

const WIDTH = 760;
const HEIGHT = 300;
const LEFT = 62;
const RIGHT = 18;
const TOP = 18;
const BOTTOM = 36;
const PLOT_W = WIDTH - LEFT - RIGHT;
const PLOT_H = HEIGHT - TOP - BOTTOM;
const GROUP_FILL = 0.62;

export function BarChart({
  labels,
  fullLabels,
  series,
  formatValue,
  formatAxis,
  className,
}: BarChartProps) {
  const [active, setActive] = useState<number | null>(null);
  const count = labels.length;

  const { max, ticks } = useMemo(() => {
    const peak = Math.max(
      0,
      ...series.flatMap((entry) => entry.values.map((value) => Math.max(0, value)))
    );
    const rounded = niceMax(peak);
    return { max: rounded, ticks: axisTicks(rounded, 4) };
  }, [series]);

  const groupWidth = count ? PLOT_W / count : PLOT_W;
  const barWidth = (groupWidth * GROUP_FILL) / Math.max(1, series.length);
  const yAt = (value: number) =>
    TOP + PLOT_H - (Math.max(0, value) / (max || 1)) * PLOT_H;
  const labelIdx = labelIndices(count, 8);

  return (
    <div className={cn("relative w-full", className)}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-auto w-full touch-pan-y"
        role="img"
        aria-label={`Comparison chart with ${series.map((entry) => entry.name).join(" and ")}`}
        onPointerLeave={() => setActive(null)}
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={LEFT}
              x2={WIDTH - RIGHT}
              y1={yAt(tick)}
              y2={yAt(tick)}
              stroke="var(--border)"
              strokeWidth="1"
              strokeDasharray={tick === 0 ? undefined : "4 6"}
              vectorEffect="non-scaling-stroke"
            />
            <text
              x={LEFT - 10}
              y={yAt(tick) + 4}
              textAnchor="end"
              className="fill-[var(--faint-foreground)]"
              fontSize="11"
            >
              {(formatAxis ?? formatValue)(tick)}
            </text>
          </g>
        ))}

        {labels.map((_, groupIndex) => {
          const groupStart = LEFT + groupIndex * groupWidth;
          return (
            <g key={groupIndex}>
              <rect
                x={groupStart}
                y={TOP}
                width={groupWidth}
                height={PLOT_H}
                fill="transparent"
                onPointerEnter={() => setActive(groupIndex)}
              />
              {series.map((entry, seriesIndex) => {
                const value = Math.max(0, entry.values[groupIndex] ?? 0);
                const height = Math.max(0, TOP + PLOT_H - yAt(value));
                const x =
                  groupStart + (groupWidth - barWidth * series.length) / 2 + seriesIndex * barWidth;
                const highlighted = active === null || active === groupIndex;
                return (
                  <rect
                    key={entry.name}
                    x={x}
                    y={yAt(value)}
                    width={Math.max(2, barWidth - 4)}
                    height={height}
                    rx="4"
                    fill={entry.color}
                    opacity={highlighted ? 1 : 0.35}
                    className="transition-opacity duration-150"
                    pointerEvents="none"
                  />
                );
              })}
            </g>
          );
        })}

        {labelIdx.map((index) => (
          <text
            key={index}
            x={LEFT + index * groupWidth + groupWidth / 2}
            y={HEIGHT - 12}
            textAnchor="middle"
            className="fill-[var(--faint-foreground)]"
            fontSize="11"
          >
            {labels[index]}
          </text>
        ))}
      </svg>

      {active !== null ? (
        <div
          className="pointer-events-none absolute top-3 z-10 min-w-36 -translate-x-1/2 rounded-xl border border-border bg-surface/95 p-2.5 shadow-pop backdrop-blur-sm"
          style={{
            left: `${Math.min(92, Math.max(8, ((LEFT + active * groupWidth + groupWidth / 2) / WIDTH) * 100))}%`,
          }}
        >
          <p className="mb-1.5 text-[11px] font-semibold text-muted-foreground">
            {fullLabels?.[active] ?? labels[active]}
          </p>
          <div className="flex flex-col gap-1">
            {series.map((entry) => (
              <div key={entry.name} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="size-2 rounded-full" style={{ backgroundColor: entry.color }} />
                  {entry.name}
                </span>
                <span className="text-[11px] font-semibold tabular-nums text-foreground">
                  {formatValue(entry.values[active] ?? 0)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {series.map((entry) => (
          <span key={entry.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
            {entry.name}
          </span>
        ))}
      </div>
    </div>
  );
}
