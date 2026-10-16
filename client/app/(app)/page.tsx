"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  ArrowRight,
  IndianRupee,
  Plus,
  Receipt,
  ShoppingBag,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useData } from "@/components/providers/DataProvider";
import { useRange } from "@/components/features/useRange";
import { RangeSelector } from "@/components/features/RangeSelector";
import { AreaChart } from "@/components/charts/AreaChart";
import { BarChart } from "@/components/charts/BarChart";
import { DonutChart } from "@/components/charts/DonutChart";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState, Notice, Skeleton } from "@/components/ui/Feedback";
import { PageHeader } from "@/components/ui/Controls";
import { StatCard } from "@/components/ui/StatCard";
import { TBody, TD, TH, THead, TR, Table, TableWrapper } from "@/components/ui/Table";
import {
  buildSeries,
  expenseCategories,
  monthlyBars,
  summarize,
  topProducts,
  withinBounds,
} from "@/lib/analytics";
import {
  formatCurrency,
  formatCurrencyCompact,
  formatDate,
  formatNumber,
} from "@/lib/format";

export default function DashboardPage() {
  const { sales, expenses, products, settings, loading, error, refresh } = useData();
  const range = useRange(sales, expenses);
  const { bounds } = range;
  const currency = settings.currency;

  const summary = useMemo(
    () => summarize(sales, expenses, bounds),
    [sales, expenses, bounds]
  );

  const series = useMemo(
    () => buildSeries(sales, expenses, bounds, 12),
    [sales, expenses, bounds]
  );

  const monthly = useMemo(() => monthlyBars(sales, expenses, 6), [sales, expenses]);

  const periodExpenses = useMemo(
    () => expenses.filter((expense) => withinBounds(expense.date, bounds)),
    [expenses, bounds]
  );

  const periodSales = useMemo(
    () => sales.filter((sale) => withinBounds(sale.date, bounds)),
    [sales, bounds]
  );

  const donut = useMemo(() => expenseCategories(periodExpenses), [periodExpenses]);
  const best = useMemo(() => topProducts(periodSales, 5), [periodSales]);
  const recent = useMemo(() => sales.slice(0, 6), [sales]);

  const trendSeries = [
    { name: "Sales", color: "var(--chart-1)", values: series.map((point) => point.sales) },
    { name: "Expenses", color: "var(--chart-2)", values: series.map((point) => point.expenses) },
  ];

  const monthlySeries = [
    { name: "Sales", color: "var(--chart-1)", values: monthly.map((point) => point.sales) },
    { name: "Expenses", color: "var(--chart-2)", values: monthly.map((point) => point.expenses) },
  ];

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="How the studio is performing across the selected period."
        actions={
          <>
            <RangeSelector
              value={range.range}
              onChange={range.setRange}
              customStart={range.customStart}
              customEnd={range.customEnd}
              onCustomStartChange={range.setCustomStart}
              onCustomEndChange={range.setCustomEnd}
            />
            <ButtonLink href="/sales" className="hidden sm:inline-flex">
              <Plus className="size-4" />
              New sale
            </ButtonLink>
          </>
        }
      />

      {error ? (
        <Notice
          tone="warning"
          title="Some data could not be loaded"
          action={
            <Button variant="outline" size="sm" onClick={() => void refresh({ silent: true })}>
              Retry
            </Button>
          }
        >
          {error}
        </Notice>
      ) : null}

      {loading ? (
        <DashboardSkeleton />
      ) : (
        <>
          <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Revenue"
              value={formatCurrency(summary.salesTotal, currency)}
              icon={IndianRupee}
              accent="var(--chart-1)"
              change={summary.salesChangePct}
              changeLabel={`vs previous ${bounds.days} day${bounds.days === 1 ? "" : "s"}`}
              spark={series.map((point) => point.sales)}
            />
            <StatCard
              label="Expenses"
              value={formatCurrency(summary.expensesTotal, currency)}
              icon={Wallet}
              accent="var(--chart-2)"
              change={summary.expensesChangePct}
              positiveIsGood={false}
              changeLabel={`vs previous ${bounds.days} day${bounds.days === 1 ? "" : "s"}`}
              spark={series.map((point) => point.expenses)}
            />
            <StatCard
              label="Net profit"
              value={formatCurrency(summary.net, currency)}
              icon={TrendingUp}
              accent="var(--chart-4)"
              change={summary.netChangePct}
              changeLabel={`${summary.marginPct.toFixed(1)}% margin`}
              spark={series.map((point) => point.net)}
            />
            <StatCard
              label="Bills raised"
              value={formatNumber(summary.salesCount)}
              icon={Receipt}
              accent="var(--chart-5)"
              hint={`${formatCurrency(summary.avgSale, currency)} average bill`}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.55fr_1fr]">
            <Card>
              <CardHeader
                title="Sales vs expenses"
                description={`${formatNumber(series.length)} buckets across the selected range`}
              />
              <CardContent>
                <AreaChart
                  labels={series.map((point) => point.label)}
                  fullLabels={series.map((point) => point.fullLabel)}
                  series={trendSeries}
                  formatValue={(value) => formatCurrency(value, currency)}
                  formatAxis={(value) => formatCurrencyCompact(value, currency)}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader
                title="Where the money goes"
                description="Expenses by category"
              />
              <CardContent>
                {donut.length ? (
                  <DonutChart
                    slices={donut}
                    centerLabel="Expenses"
                    formatValue={(value) => formatCurrencyCompact(value, currency)}
                  />
                ) : (
                  <EmptyState
                    icon={<Wallet className="size-5" />}
                    title="No expenses in this period"
                    description="Add an expense to see how spending is split by category."
                    action={
                      <ButtonLink href="/expenses" variant="outline" size="sm">
                        Add expense
                      </ButtonLink>
                    }
                  />
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.55fr_1fr]">
            <Card>
              <CardHeader
                title="Monthly performance"
                description="Sales and expenses for the last six months"
              />
              <CardContent>
                <BarChart
                  labels={monthly.map((point) => point.label)}
                  fullLabels={monthly.map((point) => point.fullLabel)}
                  series={monthlySeries}
                  formatValue={(value) => formatCurrency(value, currency)}
                  formatAxis={(value) => formatCurrencyCompact(value, currency)}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader title="Best sellers" description="By revenue in this period" />
              <CardContent className="flex flex-col gap-3">
                {best.length ? (
                  best.map((item, index) => (
                    <div key={item.name} className="flex items-center gap-3">
                      <span className="grid size-7 flex-none place-items-center rounded-lg bg-surface-muted text-xs font-bold text-muted-foreground">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {item.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatNumber(item.qty)} sold
                        </p>
                      </div>
                      <span className="text-sm font-semibold tabular-nums text-foreground">
                        {formatCurrency(item.revenue, currency)}
                      </span>
                    </div>
                  ))
                ) : (
                  <EmptyState
                    icon={<ShoppingBag className="size-5" />}
                    title="No item sales yet"
                    description="Sales with line items will rank here automatically."
                  />
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MiniStat label="Discounts given" value={formatCurrency(summary.discountTotal, currency)} />
            <MiniStat label="Fees collected" value={formatCurrency(summary.feesTotal, currency)} />
            <MiniStat label="Expense entries" value={formatNumber(summary.expensesCount)} />
            <MiniStat label="Catalogue size" value={`${formatNumber(products.length)} products`} />
          </div>

          <Card>
            <CardHeader
              title="Recent sales"
              description="The latest bills recorded"
              actions={
                <Link
                  href="/sales"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
                >
                  View all
                  <ArrowRight className="size-3.5" />
                </Link>
              }
            />
            {recent.length ? (
              <TableWrapper>
                <Table>
                  <THead>
                    <TR className="hover:bg-transparent">
                      <TH>Bill</TH>
                      <TH>Date</TH>
                      <TH>Customer</TH>
                      <TH className="text-end">Total</TH>
                      <TH className="text-end">Type</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {recent.map((sale) => (
                      <TR key={sale.id}>
                        <TD className="font-mono text-xs font-semibold">{sale.billNumber}</TD>
                        <TD className="whitespace-nowrap text-muted-foreground">
                          {formatDate(sale.date)}
                        </TD>
                        <TD className="max-w-48 truncate">{sale.customerName}</TD>
                        <TD className="text-end font-semibold tabular-nums">
                          {formatCurrency(sale.total, currency)}
                        </TD>
                        <TD className="text-end">
                          <Badge tone={sale.billType === "custom" ? "info" : "neutral"}>
                            {sale.billType === "custom" ? "Custom" : "Product"}
                          </Badge>
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </TableWrapper>
            ) : (
              <EmptyState
                icon={<Receipt className="size-5" />}
                title="No sales recorded yet"
                description="Create your first bill to populate the dashboard."
                action={
                  <ButtonLink href="/sales" size="sm">
                    Create a bill
                  </ButtonLink>
                }
              />
            )}
          </Card>
        </>
      )}
    </>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-field bg-surface px-4 py-3 shadow-field">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-32 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.55fr_1fr]">
        <Skeleton className="h-80 rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
      <Skeleton className="h-64 rounded-2xl" />
    </>
  );
}
