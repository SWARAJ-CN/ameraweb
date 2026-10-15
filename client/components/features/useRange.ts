"use client";

import { useMemo, useState } from "react";
import { resolveBounds, type DateBounds, type RangeKey } from "@/lib/analytics";
import { parseDateInput, toDateInputValue } from "@/lib/format";
import type { Expense, Sale } from "@/lib/types";

const DAY_MS = 86_400_000;

export interface RangeState {
  range: RangeKey;
  setRange: (value: RangeKey) => void;
  customStart: string;
  customEnd: string;
  setCustomStart: (value: string) => void;
  setCustomEnd: (value: string) => void;
  bounds: DateBounds;
}

/** Shared range state used by the dashboard and reports pages. */
export function useRange(sales: Sale[], expenses: Expense[]): RangeState {
  const [range, setRange] = useState<RangeKey>("30d");
  const [customStart, setCustomStart] = useState(() =>
    toDateInputValue(new Date(Date.now() - 29 * DAY_MS))
  );
  const [customEnd, setCustomEnd] = useState(() => toDateInputValue(new Date()));

  const earliest = useMemo(() => {
    const times: number[] = [];
    for (const sale of sales) times.push(new Date(sale.date).getTime());
    for (const expense of expenses) times.push(new Date(expense.date).getTime());
    const valid = times.filter(Number.isFinite);
    return valid.length ? new Date(Math.min(...valid)) : undefined;
  }, [sales, expenses]);

  const bounds = useMemo(
    () =>
      resolveBounds(range, {
        earliest,
        customStart: parseDateInput(customStart),
        customEnd: parseDateInput(customEnd),
      }),
    [range, earliest, customStart, customEnd]
  );

  return {
    range,
    setRange,
    customStart,
    customEnd,
    setCustomStart,
    setCustomEnd,
    bounds,
  };
}
