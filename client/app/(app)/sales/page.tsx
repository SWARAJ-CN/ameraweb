"use client";

import { useMemo, useState } from "react";
import { Download, Eye, Pencil, Plus, Receipt, Trash2 } from "lucide-react";
import { useData } from "@/components/providers/DataProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { SaleForm } from "@/components/features/SaleForm";
import { SaleDetail } from "@/components/features/SaleDetail";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState, Skeleton } from "@/components/ui/Feedback";
import { PageHeader, Pagination, SearchInput } from "@/components/ui/Controls";
import { Field, Select } from "@/components/ui/Input";
import { DateInput } from "@/components/ui/DatePicker";
import { TBody, TD, TH, THead, TR, Table, TableWrapper } from "@/components/ui/Table";
import { downloadCsv } from "@/lib/csv";
import { formatCurrency, formatDate, parseDateInput } from "@/lib/format";
import type { Sale } from "@/lib/types";
import type { SaleDraft } from "@/lib/normalize";

const PAGE_SIZES = [10, 25, 50];

export default function SalesPage() {
  const { sales, products, settings, loading, createSale, updateSale, deleteSale } = useData();
  const toast = useToast();
  const currency = settings.currency;

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Sale | null>(null);
  const [detail, setDetail] = useState<Sale | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Sale | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const start = parseDateInput(from);
    const end = parseDateInput(to);
    if (end) end.setHours(23, 59, 59, 999);

    return sales.filter((sale) => {
      if (typeFilter !== "all" && sale.billType !== typeFilter) return false;
      const time = new Date(sale.date).getTime();
      if (start && time < start.getTime()) return false;
      if (end && time > end.getTime()) return false;
      if (
        query &&
        !sale.billNumber.toLowerCase().includes(query) &&
        !sale.customerName.toLowerCase().includes(query)
      ) {
        return false;
      }
      return true;
    });
  }, [sales, search, typeFilter, from, to]);

  const resetPage = () => setPage(1);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const rows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const filteredTotal = filtered.reduce((sum, sale) => sum + sale.total, 0);

  const nextBillNumber = useMemo(
    () => `${settings.invoicePrefix || "AM-"}${1000 + sales.length + 1}`,
    [settings.invoicePrefix, sales.length]
  );

  const handleSubmit = async (draft: SaleDraft) => {
    if (editing) {
      await updateSale(editing.id, draft);
      toast.success("Sale updated", `Bill ${draft.billNumber} saved.`);
    } else {
      await createSale(draft);
      toast.success("Sale created", `Bill ${draft.billNumber} recorded.`);
    }
    setFormOpen(false);
    setEditing(null);
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteSale(pendingDelete.id);
      toast.success("Sale deleted", `Bill ${pendingDelete.billNumber} removed.`);
      setPendingDelete(null);
    } catch (caught) {
      toast.error(
        "Could not delete the sale",
        caught instanceof Error ? caught.message : undefined
      );
    } finally {
      setDeleting(false);
    }
  };

  const exportCsv = () => {
    downloadCsv(
      `amare-sales-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        [
          "Bill",
          "Date",
          "Customer",
          "Type",
          "Items",
          "Product amount",
          "Discount",
          "Total",
          "Advance paid",
        ],
        ...filtered.map((sale) => [
          sale.billNumber,
          formatDate(sale.date),
          sale.customerName,
          sale.billType,
          sale.items.map((item) => `${item.name} x${item.qty}`).join("; "),
          sale.productAmount,
          sale.discount,
          sale.total,
          sale.advancePaid,
        ]),
      ]
    );
    toast.success("Export ready", `${filtered.length} sales written to CSV.`);
  };

  return (
    <>
      <PageHeader
        title="Sales"
        description="Every bill and custom order, with full edit and delete controls."
        actions={
          <>
            <Button variant="outline" onClick={exportCsv} disabled={!filtered.length}>
              <Download className="size-4" />
              Export CSV
            </Button>
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="size-4" />
              New sale
            </Button>
          </>
        }
      />

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 border-b border-border pb-4">
          <SearchInput
            value={search}
            onChange={(value) => {
              setSearch(value);
              resetPage();
            }}
            placeholder="Search bill number or customer…"
            className="min-w-56 flex-1"
          />
          <Field label="Type" htmlFor="sales-type" className="w-40">
            <Select
              id="sales-type"
              value={typeFilter}
              onChange={(event) => {
                setTypeFilter(event.target.value);
                resetPage();
              }}
            >
              <option value="all">All types</option>
              <option value="product">Product sales</option>
              <option value="custom">Custom orders</option>
            </Select>
          </Field>
          <Field label="From" htmlFor="sales-from" className="w-40">
            <DateInput
              id="sales-from"
              value={from}
              max={to || undefined}
              onChange={(event) => {
                setFrom(event.target.value);
                resetPage();
              }}
            />
          </Field>
          <Field label="To" htmlFor="sales-to" className="w-40">
            <DateInput
              id="sales-to"
              value={to}
              min={from || undefined}
              onChange={(event) => {
                setTo(event.target.value);
                resetPage();
              }}
            />
          </Field>
        </CardContent>

        {loading ? (
          <div className="flex flex-col gap-2 p-5">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-10" />
            ))}
          </div>
        ) : rows.length ? (
          <>
            <TableWrapper>
              <Table>
                <THead>
                  <TR className="hover:bg-transparent">
                    <TH>Bill</TH>
                    <TH>Date</TH>
                    <TH>Customer</TH>
                    <TH>Items</TH>
                    <TH className="text-end">Total</TH>
                    <TH className="text-end">Actions</TH>
                  </TR>
                </THead>
                <TBody>
                  {rows.map((sale) => (
                    <TR key={sale.id}>
                      <TD>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDetail(sale)}
                          className="h-auto justify-start px-0 font-mono text-xs font-semibold text-brand hover:bg-transparent hover:underline"
                        >
                          {sale.billNumber}
                        </Button>
                        <div className="mt-0.5">
                          <Badge tone={sale.billType === "custom" ? "info" : "neutral"}>
                            {sale.billType === "custom" ? "Custom" : "Product"}
                          </Badge>
                        </div>
                      </TD>
                      <TD className="whitespace-nowrap text-muted-foreground">
                        {formatDate(sale.date)}
                      </TD>
                      <TD className="max-w-52">
                        <span className="block truncate">{sale.customerName}</span>
                        {sale.customerAddress.phone ? (
                          <span className="block truncate text-xs text-faint-foreground">
                            {sale.customerAddress.phone}
                          </span>
                        ) : null}
                      </TD>
                      <TD className="text-muted-foreground">
                        {sale.items.length ? `${sale.items.length} item(s)` : "—"}
                      </TD>
                      <TD className="text-end font-semibold tabular-nums">
                        {formatCurrency(sale.total, currency)}
                      </TD>
                      <TD>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            aria-label={`View ${sale.billNumber}`}
                            onClick={() => setDetail(sale)}
                          >
                            <Eye className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            aria-label={`Edit ${sale.billNumber}`}
                            onClick={() => {
                              setEditing(sale);
                              setFormOpen(true);
                            }}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-danger hover:bg-danger-soft"
                            aria-label={`Delete ${sale.billNumber}`}
                            onClick={() => setPendingDelete(sale)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableWrapper>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  Rows
                  <Select
                    aria-label="Rows per page"
                    className="w-20"
                    value={String(pageSize)}
                    onChange={(event) => {
                      setPageSize(Number(event.target.value));
                      resetPage();
                    }}
                  >
                    {PAGE_SIZES.map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </Select>
                </label>
                <p className="text-xs text-muted-foreground">
                  Filtered total{" "}
                  <span className="font-semibold tabular-nums text-foreground">
                    {formatCurrency(filteredTotal, currency)}
                  </span>
                </p>
              </div>
              <Pagination
                page={currentPage}
                pageCount={pageCount}
                total={filtered.length}
                pageSize={pageSize}
                onChange={setPage}
              />
            </div>
          </>
        ) : (
          <EmptyState
            icon={<Receipt className="size-5" />}
            title={sales.length ? "No sales match these filters" : "No sales yet"}
            description={
              sales.length
                ? "Try clearing the search or widening the date range."
                : "Create your first bill to start tracking revenue."
            }
            action={
              sales.length ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setTypeFilter("all");
                    setFrom("");
                    setTo("");
                    setPage(1);
                  }}
                >
                  Clear filters
                </Button>
              ) : (
                <Button size="sm" onClick={() => setFormOpen(true)}>
                  <Plus className="size-4" />
                  New sale
                </Button>
              )
            }
          />
        )}
      </Card>

      {formOpen ? (
        <SaleForm
          key={editing?.id ?? "new"}
          sale={editing}
          products={products}
          currency={currency}
          nextBillNumber={nextBillNumber}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
          onSubmit={handleSubmit}
        />
      ) : null}

      <SaleDetail
        sale={detail}
        settings={settings}
        onClose={() => setDetail(null)}
        onEdit={(sale) => {
          setDetail(null);
          setEditing(sale);
          setFormOpen(true);
        }}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete this sale?"
        description={
          pendingDelete
            ? `Bill ${pendingDelete.billNumber} for ${pendingDelete.customerName} will be permanently removed. This cannot be undone.`
            : ""
        }
        confirmLabel="Delete sale"
        destructive
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}
