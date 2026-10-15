"use client";

import { useId, useMemo, useState } from "react";
import { axisTicks, niceMax } from "@/lib/analytics";
import { cn } from "@/lib/cn";
import { areaPath, labelIndices, smoothPath, type Point } from "./chart-utils";

export interface AreaSeries {
  name: string;
  color: string;
  values: number[];
}

interface AreaChartProps {
  labels: string[];
  fullLabels?: string[];
  series: AreaSeries[];
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

export function AreaChart({
  labels,
  fullLabels,
  series,
  formatValue,
  formatAxis,
  className,
}: AreaChartProps) {
  const gradientPrefix = useId();
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

  const xAt = (index: number) =>
    count <= 1 ? LEFT + PLOT_W / 2 : LEFT + (index / (count - 1)) * PLOT_W;
  const yAt = (value: number) =>
    TOP + PLOT_H - (Math.max(0, value) / (max || 1)) * PLOT_H;

  const labelIdx = labelIndices(count, 8);

  const handleMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (count === 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width) return;
    const svgX = ((event.clientX - rect.left) / rect.width) * WIDTH;
    const ratio = (svgX - LEFT) / PLOT_W;
    const index = Math.round(ratio * Math.max(1, count - 1));
    setActive(Math.min(count - 1, Math.max(0, index)));
  };

  return (
    <div className={cn("relative w-full", className)}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-auto w-full touch-pan-y"
        role="img"
        aria-label={`Trend chart with ${series.map((entry) => entry.name).join(" and ")}`}
        onPointerMove={handleMove}
        onPointerLeave={() => setActive(null)}
      >
        <defs>
          {series.map((entry, index) => (
            <linearGradient
              key={entry.name}
              id={`${gradientPrefix}-${index}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor={entry.color} stopOpacity="0.28" />
              <stop offset="100%" stopColor={entry.color} stopOpacity="0.01" />
            </linearGradient>
          ))}
        </defs>

        {/* Gridlines + y axis labels */}
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

        {/* Series */}
        {series.map((entry, index) => {
          const points: Point[] = entry.values.map((value, pointIndex) => [
            xAt(pointIndex),
            yAt(value),
          ]);
          return (
            <g key={entry.name}>
              <path
                d={areaPath(points, TOP + PLOT_H)}
                fill={`url(#${gradientPrefix}-${index})`}
              />
              <path
                d={smoothPath(points)}
                fill="none"
                stroke={entry.color}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          );
        })}

        {/* Hover guide */}
        {active !== null ? (
          <g pointerEvents="none">
            <line
              x1={xAt(active)}
              x2={xAt(active)}
              y1={TOP}
              y2={TOP + PLOT_H}
              stroke="var(--border-strong)"
              strokeWidth="1"
              strokeDasharray="4 4"
              vectorEffect="non-scaling-stroke"
            />
            {series.map((entry) => (
              <circle
                key={entry.name}
                cx={xAt(active)}
                cy={yAt(entry.values[active] ?? 0)}
                r="4.5"
                fill="var(--surface)"
                stroke={entry.color}
                strokeWidth="2.5"
              />
            ))}
          </g>
        ) : null}

        {/* x axis labels */}
        {labelIdx.map((index) => (
          <text
            key={index}
            x={xAt(index)}
            y={HEIGHT - 12}
            textAnchor={index === 0 ? "start" : index === count - 1 ? "end" : "middle"}
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
          style={{ left: `${Math.min(92, Math.max(8, (xAt(active) / WIDTH) * 100))}%` }}
        >
          <p className="mb-1.5 text-[11px] font-semibold text-muted-foreground">
            {fullLabels?.[active] ?? labels[active]}
          </p>
          <div className="flex flex-col gap-1">
            {series.map((entry) => (
              <div key={entry.name} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: entry.color }}
                  />
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
