"use client";

import { useMemo } from "react";
import {
  BadgePercent,
  IndianRupee,
  Receipt,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { useData } from "@/components/providers/DataProvider";
import { useRange } from "@/components/features/useRange";
import { RangeSelector } from "@/components/features/RangeSelector";
import { AreaChart } from "@/components/charts/AreaChart";
import { BarChart } from "@/components/charts/BarChart";
import { DonutChart } from "@/components/charts/DonutChart";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState, Notice, Skeleton } from "@/components/ui/Feedback";
import { PageHeader } from "@/components/ui/Controls";
import { StatCard } from "@/components/ui/StatCard";
import { TBody, TD, TH, THead, TR, Table, TableWrapper } from "@/components/ui/Table";
import { downloadCsv } from "@/lib/csv";
import { useToast } from "@/components/providers/ToastProvider";
import {
  buildSeries,
  expenseCategories,
  monthlyBars,
  paymentMix,
  productCategories,
  salesByType,
  summarize,
  topCustomers,
  topProducts,
  withinBounds,
} from "@/lib/analytics";
import {
  formatCurrency,
  formatCurrencyCompact,
  formatDate,
  formatNumber,
} from "@/lib/format";

export default function ReportsPage() {
  const { sales, expenses, products, settings, loading, error } = useData();
  const toast = useToast();
  const range = useRange(sales, expenses);
  const { bounds } = range;
  const currency = settings.currency;

  const periodSales = useMemo(
    () => sales.filter((sale) => withinBounds(sale.date, bounds)),
    [sales, bounds]
  );
  const periodExpenses = useMemo(
    () => expenses.filter((expense) => withinBounds(expense.date, bounds)),
    [expenses, bounds]
  );

  const summary = useMemo(
    () => summarize(sales, expenses, bounds),
    [sales, expenses, bounds]
  );
  const series = useMemo(
    () => buildSeries(sales, expenses, bounds, 14),
    [sales, expenses, bounds]
  );
  const yearly = useMemo(() => monthlyBars(sales, expenses, 12), [sales, expenses]);
  const expenseSplit = useMemo(() => expenseCategories(periodExpenses), [periodExpenses]);
  const paymentSplit = useMemo(() => paymentMix(periodExpenses), [periodExpenses]);
  const productSplit = useMemo(() => productCategories(products), [products]);
  const typeSplit = useMemo(() => salesByType(periodSales), [periodSales]);
  const best = useMemo(() => topProducts(periodSales, 8), [periodSales]);
  const customers = useMemo(() => topCustomers(periodSales, 8), [periodSales]);

  const trendSeries = [
    { name: "Sales", color: "var(--chart-1)", values: series.map((point) => point.sales) },
    { name: "Expenses", color: "var(--chart-2)", values: series.map((point) => point.expenses) },
    { name: "Net", color: "var(--chart-4)", values: series.map((point) => point.net) },
  ];
  const yearlySeries = [
    { name: "Sales", color: "var(--chart-1)", values: yearly.map((point) => point.sales) },
    { name: "Expenses", color: "var(--chart-2)", values: yearly.map((point) => point.expenses) },
  ];

  const exportSummary = () => {
    downloadCsv(
      `amare-report-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        ["Metric", "Value"],
        ["Range", `${formatDate(bounds.start)} – ${formatDate(bounds.end)}`],
        ["Revenue", summary.salesTotal],
        ["Expenses", summary.expensesTotal],
        ["Net profit", summary.net],
        ["Margin %", summary.marginPct.toFixed(2)],
        ["Bills", summary.salesCount],
        ["Expense entries", summary.expensesCount],
        ["Average bill", summary.avgSale],
        ["Discounts given", summary.discountTotal],
        ["Fees collected", summary.feesTotal],
        [],
        ["Top products", "Qty", "Revenue"],
        ...best.map((item) => [item.name, item.qty, item.revenue]),
        [],
        ["Top customers", "Bills", "Revenue"],
        ...customers.map((item) => [item.name, item.count, item.total]),
      ]
    );
    toast.success("Report exported", "Summary, top products and customers saved.");
  };

  return (
    <>
      <PageHeader
        title="Reports"
        description="A deeper look at revenue, spending and customer behaviour."
        actions={
          <>
            <Button variant="outline" onClick={exportSummary} disabled={!sales.length}>
              Export summary
            </Button>
            <RangeSelector
              value={range.range}
              onChange={range.setRange}
              customStart={range.customStart}
              customEnd={range.customEnd}
              onCustomStartChange={range.setCustomStart}
              onCustomEndChange={range.setCustomEnd}
            />
          </>
        }
      />

      {error ? (
        <Notice tone="warning" title="Some data could not be loaded">
          {error}
        </Notice>
      ) : null}

      {loading ? (
        <ReportsSkeleton />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
              changeLabel={`${summary.expensesCount} entries`}
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
              label="Average bill"
              value={formatCurrency(summary.avgSale, currency)}
              icon={Receipt}
              accent="var(--chart-5)"
              hint={`${formatNumber(summary.salesCount)} bills in range`}
            />
          </div>

          <Card>
            <CardHeader
              title="Trend across the period"
              description={`${formatDate(bounds.start)} – ${formatDate(bounds.end)}`}
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
              title="Rolling twelve months"
              description="Calendar-month sales and expenses"
            />
            <CardContent>
              <BarChart
                labels={yearly.map((point) => point.label)}
                fullLabels={yearly.map((point) => point.fullLabel)}
                series={yearlySeries}
                formatValue={(value) => formatCurrency(value, currency)}
                formatAxis={(value) => formatCurrencyCompact(value, currency)}
              />
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            <BreakdownCard
              title="Spending by category"
              description="Expenses in this period"
              slices={expenseSplit}
              centerLabel="Expenses"
              currency={currency}
              icon={<Wallet className="size-5" />}
              emptyTitle="No expenses in this period"
            />
            <BreakdownCard
              title="Payment methods"
              description="How expenses were settled"
              slices={paymentSplit}
              centerLabel="Paid"
              currency={currency}
              icon={<BadgePercent className="size-5" />}
              emptyTitle="No payments recorded"
            />
            <BreakdownCard
              title="Sales by type"
              description="Product sales vs custom orders"
              slices={typeSplit}
              centerLabel="Revenue"
              currency={currency}
              icon={<Receipt className="size-5" />}
              emptyTitle="No sales in this period"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader
                title="Best selling items"
                description="Ranked by revenue in this period"
              />
              {best.length ? (
                <TableWrapper>
                  <Table>
                    <THead>
                      <TR className="hover:bg-transparent">
                        <TH className="w-10">#</TH>
                        <TH>Item</TH>
                        <TH className="text-end">Sold</TH>
                        <TH className="text-end">Revenue</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {best.map((item, index) => (
                        <TR key={item.name}>
                          <TD className="text-muted-foreground">{index + 1}</TD>
                          <TD className="max-w-56 truncate font-medium">{item.name}</TD>
                          <TD className="text-end tabular-nums text-muted-foreground">
                            {formatNumber(item.qty)}
                          </TD>
                          <TD className="text-end font-semibold tabular-nums">
                            {formatCurrency(item.revenue, currency)}
                          </TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </TableWrapper>
              ) : (
                <EmptyState
                  icon={<Receipt className="size-5" />}
                  title="No item sales yet"
                  description="Sales with line items will rank here."
                />
              )}
            </Card>

            <Card>
              <CardHeader
                title="Top customers"
                description="By total value in this period"
              />
              {customers.length ? (
                <TableWrapper>
                  <Table>
                    <THead>
                      <TR className="hover:bg-transparent">
                        <TH>Customer</TH>
                        <TH className="text-end">Bills</TH>
                        <TH className="text-end">Revenue</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {customers.map((customer) => (
                        <TR key={customer.name}>
                          <TD className="max-w-56 truncate font-medium">{customer.name}</TD>
                          <TD className="text-end tabular-nums text-muted-foreground">
                            {formatNumber(customer.count)}
                          </TD>
                          <TD className="text-end font-semibold tabular-nums">
                            {formatCurrency(customer.total, currency)}
                          </TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </TableWrapper>
              ) : (
                <EmptyState
                  icon={<Users className="size-5" />}
                  title="No customers yet"
                  description="Named customers from your bills will appear here."
                />
              )}
            </Card>
          </div>

          <Card>
            <CardHeader
              title="Catalogue value by category"
              description={`${formatNumber(products.length)} products on file`}
            />
            <CardContent>
              {productSplit.length ? (
                <DonutChart
                  slices={productSplit}
                  centerLabel="Catalogue"
                  formatValue={(value) => formatCurrencyCompact(value, currency)}
                />
              ) : (
                <EmptyState
                  icon={<BadgePercent className="size-5" />}
                  title="No products yet"
                  description="Add catalogue items to see how value is distributed."
                />
              )}
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}

function BreakdownCard({
  title,
  description,
  slices,
  centerLabel,
  currency,
  icon,
  emptyTitle,
}: {
  title: string;
  description: string;
  slices: ReturnType<typeof expenseCategories>;
  centerLabel: string;
  currency: string;
  icon: React.ReactNode;
  emptyTitle: string;
}) {
  return (
    <Card>
      <CardHeader title={title} description={description} />
      <CardContent>
        {slices.length ? (
          <DonutChart
            slices={slices}
            centerLabel={centerLabel}
            formatValue={(value) => formatCurrencyCompact(value, currency)}
          />
        ) : (
          <EmptyState icon={icon} title={emptyTitle} />
        )}
      </CardContent>
    </Card>
  );
}

function ReportsSkeleton() {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-32 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-2xl" />
      <Skeleton className="h-80 rounded-2xl" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    </>
  );
}
