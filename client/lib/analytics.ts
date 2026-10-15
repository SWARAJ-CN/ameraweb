import type { Expense, Product, Sale } from "./types";

export type RangeKey =
  | "today"
  | "7d"
  | "30d"
  | "90d"
  | "month"
  | "year"
  | "all"
  | "custom";

export const RANGE_OPTIONS: Array<{ key: RangeKey; label: string }> = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
  { key: "month", label: "This month" },
  { key: "year", label: "This year" },
  { key: "all", label: "All time" },
];

export const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
  "var(--chart-8)",
];

export const colorAt = (index: number): string =>
  CHART_COLORS[index % CHART_COLORS.length];

const DAY_MS = 86_400_000;

const startOfDay = (date: Date): Date => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const endOfDay = (date: Date): Date => {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
};

const addDays = (date: Date, days: number): Date => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
};

export interface DateBounds {
  start: Date;
  end: Date;
  prevStart: Date;
  prevEnd: Date;
  days: number;
}

export function resolveBounds(
  range: RangeKey,
  options: { customStart?: Date; customEnd?: Date; earliest?: Date } = {}
): DateBounds {
  const now = new Date();
  let start = startOfDay(now);
  let end = endOfDay(now);

  switch (range) {
    case "today":
      break;
    case "7d":
      start = startOfDay(addDays(now, -6));
      break;
    case "30d":
      start = startOfDay(addDays(now, -29));
      break;
    case "90d":
      start = startOfDay(addDays(now, -89));
      break;
    case "month":
      start = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
      break;
    case "year":
      start = startOfDay(new Date(now.getFullYear(), 0, 1));
      break;
    case "all": {
      const earliest = options.earliest ?? addDays(now, -365);
      start = startOfDay(earliest);
      break;
    }
    case "custom": {
      if (options.customStart) start = startOfDay(options.customStart);
      if (options.customEnd) end = endOfDay(options.customEnd);
      if (end < start) [start, end] = [startOfDay(options.customEnd ?? now), endOfDay(options.customStart ?? now)];
      break;
    }
  }

  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1);
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = startOfDay(addDays(prevEnd, -(days - 1)));

  return { start, end, prevStart, prevEnd, days };
}

const inWindow = (iso: string, start: Date, end: Date): boolean => {
  const time = new Date(iso).getTime();
  return time >= start.getTime() && time <= end.getTime();
};

/** True when an ISO date falls inside the resolved range. */
export const withinBounds = (iso: string, bounds: DateBounds): boolean =>
  inWindow(iso, bounds.start, bounds.end);

export interface Summary {
  salesTotal: number;
  expensesTotal: number;
  net: number;
  salesCount: number;
  expensesCount: number;
  avgSale: number;
  discountTotal: number;
  feesTotal: number;
  marginPct: number;
  salesChangePct: number;
  expensesChangePct: number;
  netChangePct: number;
}

const changePct = (current: number, previous: number): number => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / Math.abs(previous)) * 100;
};

export function summarize(
  sales: Sale[],
  expenses: Expense[],
  bounds: DateBounds
): Summary {
  const { start, end, prevStart, prevEnd } = bounds;

  const currentSales = sales.filter((sale) => inWindow(sale.date, start, end));
  const currentExpenses = expenses.filter((item) => inWindow(item.date, start, end));
  const previousSales = sales.filter((sale) => inWindow(sale.date, prevStart, prevEnd));
  const previousExpenses = expenses.filter((item) =>
    inWindow(item.date, prevStart, prevEnd)
  );

  const salesTotal = currentSales.reduce((sum, sale) => sum + sale.total, 0);
  const expensesTotal = currentExpenses.reduce((sum, item) => sum + item.amount, 0);
  const prevSalesTotal = previousSales.reduce((sum, sale) => sum + sale.total, 0);
  const prevExpensesTotal = previousExpenses.reduce((sum, item) => sum + item.amount, 0);
  const net = salesTotal - expensesTotal;
  const prevNet = prevSalesTotal - prevExpensesTotal;

  return {
    salesTotal,
    expensesTotal,
    net,
    salesCount: currentSales.length,
    expensesCount: currentExpenses.length,
    avgSale: currentSales.length ? salesTotal / currentSales.length : 0,
    discountTotal: currentSales.reduce((sum, sale) => sum + sale.discount, 0),
    feesTotal: currentSales.reduce(
      (sum, sale) => sum + sale.handlingFee + sale.deliveryFee,
      0
    ),
    marginPct: salesTotal > 0 ? (net / salesTotal) * 100 : 0,
    salesChangePct: changePct(salesTotal, prevSalesTotal),
    expensesChangePct: changePct(expensesTotal, prevExpensesTotal),
    netChangePct: changePct(net, prevNet),
  };
}

export interface SeriesPoint {
  label: string;
  fullLabel: string;
  sales: number;
  expenses: number;
  net: number;
  start: Date;
}

const hourLabel = (date: Date) =>
  new Intl.DateTimeFormat("en-IN", { hour: "2-digit", hour12: false }).format(date);

/** Buckets the range into evenly spaced points for the trend chart. */
export function buildSeries(
  sales: Sale[],
  expenses: Expense[],
  bounds: DateBounds,
  maxPoints = 12
): SeriesPoint[] {
  const { start, end } = bounds;
  const span = end.getTime() - start.getTime();
  const days = span / DAY_MS;
  const bucketCount = Math.max(2, Math.min(maxPoints, Math.ceil(days) || 2));
  const step = span / bucketCount;

  const labelFor = (date: Date) => {
    if (step < DAY_MS) return hourLabel(date);
    if (step < 60 * DAY_MS) {
      return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short" }).format(date);
    }
    return new Intl.DateTimeFormat("en-IN", { month: "short", year: "2-digit" }).format(date);
  };

  const points: SeriesPoint[] = [];
  for (let index = 0; index < bucketCount; index += 1) {
    const bucketStart = new Date(start.getTime() + index * step);
    const bucketEnd = new Date(start.getTime() + (index + 1) * step - 1);
    const salesTotal = sales
      .filter((sale) => inWindow(sale.date, bucketStart, bucketEnd))
      .reduce((sum, sale) => sum + sale.total, 0);
    const expensesTotal = expenses
      .filter((item) => inWindow(item.date, bucketStart, bucketEnd))
      .reduce((sum, item) => sum + item.amount, 0);
    points.push({
      label: labelFor(bucketStart),
      fullLabel:
        step < DAY_MS
          ? `${hourLabel(bucketStart)}:00`
          : new Intl.DateTimeFormat("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            }).format(bucketStart),
      sales: salesTotal,
      expenses: expensesTotal,
      net: salesTotal - expensesTotal,
      start: bucketStart,
    });
  }
  return points;
}

export interface BarPoint {
  label: string;
  fullLabel: string;
  sales: number;
  expenses: number;
}

/** Calendar-month totals for the grouped bar chart. */
export function monthlyBars(
  sales: Sale[],
  expenses: Expense[],
  months = 6
): BarPoint[] {
  const now = new Date();
  const points: BarPoint[] = [];
  for (let index = months - 1; index >= 0; index -= 1) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - index, 1);
    const start = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const end = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59, 999);
    points.push({
      label: new Intl.DateTimeFormat("en-IN", { month: "short" }).format(monthDate),
      fullLabel: new Intl.DateTimeFormat("en-IN", {
        month: "long",
        year: "numeric",
      }).format(monthDate),
      sales: sales
        .filter((sale) => inWindow(sale.date, start, end))
        .reduce((sum, sale) => sum + sale.total, 0),
      expenses: expenses
        .filter((item) => inWindow(item.date, start, end))
        .reduce((sum, item) => sum + item.amount, 0),
    });
  }
  return points;
}

export interface Slice {
  label: string;
  value: number;
  color: string;
}

export function breakdown(
  entries: Array<{ label: string; value: number }>,
  limit = 6
): Slice[] {
  const totals = new Map<string, number>();
  for (const entry of entries) {
    const key = entry.label.trim() || "Other";
    totals.set(key, (totals.get(key) ?? 0) + entry.value);
  }
  const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, limit);
  const rest = sorted.slice(limit);
  const slices = top.map(([label, value], index) => ({
    label,
    value,
    color: colorAt(index),
  }));
  if (rest.length) {
    slices.push({
      label: "Other",
      value: rest.reduce((sum, [, value]) => sum + value, 0),
      color: "var(--faint-foreground)",
    });
  }
  return slices.filter((slice) => slice.value > 0);
}

export function expenseCategories(expenses: Expense[]): Slice[] {
  return breakdown(
    expenses.map((expense) => ({ label: expense.category, value: expense.amount })),
    5
  );
}

export function productCategories(products: Product[]): Slice[] {
  return breakdown(
    products.map((product) => ({
      label: product.category || "Uncategorised",
      value: product.price,
    })),
    5
  );
}

export function paymentMix(expenses: Expense[]): Slice[] {
  return breakdown(
    expenses.map((expense) => ({ label: expense.paymentMethod, value: expense.amount })),
    5
  );
}

export interface ProductStat {
  name: string;
  qty: number;
  revenue: number;
}

export function topProducts(sales: Sale[], limit = 5): ProductStat[] {
  const totals = new Map<string, ProductStat>();
  for (const sale of sales) {
    for (const item of sale.items) {
      const name = item.name.trim() || "Unnamed item";
      const current = totals.get(name) ?? { name, qty: 0, revenue: 0 };
      current.qty += item.qty;
      current.revenue += item.qty * item.price;
      totals.set(name, current);
    }
  }
  return [...totals.values()]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

export function salesByType(sales: Sale[]): Slice[] {
  return breakdown(
    sales.map((sale) => ({
      label: sale.billType === "custom" ? "Custom orders" : sale.saleType || "Product sales",
      value: sale.total,
    })),
    5
  );
}

export function topCustomers(sales: Sale[], limit = 5): Array<{ name: string; total: number; count: number }> {
  const totals = new Map<string, { name: string; total: number; count: number }>();
  for (const sale of sales) {
    const name = sale.customerName.trim() || "Walk-in Customer";
    const current = totals.get(name) ?? { name, total: 0, count: 0 };
    current.total += sale.total;
    current.count += 1;
    totals.set(name, current);
  }
  return [...totals.values()].sort((a, b) => b.total - a.total).slice(0, limit);
}

/** Rounds an axis maximum up to a friendly tick value. */
export function niceMax(value: number): number {
  if (value <= 0) return 10;
  const exponent = Math.floor(Math.log10(value));
  const magnitude = Math.pow(10, exponent);
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

export function axisTicks(max: number, count = 4): number[] {
  const ticks: number[] = [];
  for (let index = 0; index <= count; index += 1) {
    ticks.push((max / count) * index);
  }
  return ticks;
}
