"use client";

import { useMemo, useState } from "react";
import { Download, Pencil, Plus, Trash2, Wallet } from "lucide-react";
import { useData } from "@/components/providers/DataProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { ExpenseForm } from "@/components/features/ExpenseForm";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState, Skeleton } from "@/components/ui/Feedback";
import { PageHeader, Pagination, SearchInput } from "@/components/ui/Controls";
import { Field, Input, Select } from "@/components/ui/Input";
import { TBody, TD, TH, THead, TR, Table, TableWrapper } from "@/components/ui/Table";
import { downloadCsv } from "@/lib/csv";
import { formatCurrency, formatDate, formatNumber, parseDateInput } from "@/lib/format";
import type { Expense } from "@/lib/types";
import type { ExpenseDraft } from "@/lib/normalize";

const PAGE_SIZES = [10, 25, 50];

export default function ExpensesPage() {
  const { expenses, settings, loading, createExpense, updateExpense, deleteExpense } = useData();
  const toast = useToast();
  const currency = settings.currency;

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState(false);

  const categories = useMemo(
    () => [...new Set(expenses.map((expense) => expense.category).filter(Boolean))].sort(),
    [expenses]
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const start = parseDateInput(from);
    const end = parseDateInput(to);
    if (end) end.setHours(23, 59, 59, 999);

    return expenses.filter((expense) => {
      if (typeFilter !== "all" && expense.type !== typeFilter) return false;
      if (categoryFilter !== "all" && expense.category !== categoryFilter) return false;
      const time = new Date(expense.date).getTime();
      if (start && time < start.getTime()) return false;
      if (end && time > end.getTime()) return false;
      if (
        query &&
        !expense.description.toLowerCase().includes(query) &&
        !expense.notes.toLowerCase().includes(query) &&
        !expense.category.toLowerCase().includes(query)
      ) {
        return false;
      }
      return true;
    });
  }, [expenses, search, typeFilter, categoryFilter, from, to]);

  const resetPage = () => setPage(1);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const rows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const filteredTotal = filtered.reduce((sum, expense) => sum + expense.amount, 0);
  const average = filtered.length ? filteredTotal / filtered.length : 0;

  const handleSubmit = async (draft: ExpenseDraft) => {
    if (editing) {
      await updateExpense(editing.id, draft);
      toast.success("Expense updated", draft.description);
    } else {
      await createExpense(draft);
      toast.success("Expense recorded", draft.description);
    }
    setFormOpen(false);
    setEditing(null);
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteExpense(pendingDelete.id);
      toast.success("Expense deleted", pendingDelete.description);
      setPendingDelete(null);
    } catch (caught) {
      toast.error(
        "Could not delete the expense",
        caught instanceof Error ? caught.message : undefined
      );
    } finally {
      setDeleting(false);
    }
  };

  const exportCsv = () => {
    downloadCsv(
      `amare-expenses-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        ["Date", "Type", "Description", "Category", "Payment method", "Amount", "Notes"],
        ...filtered.map((expense) => [
          formatDate(expense.date),
          expense.type,
          expense.description,
          expense.category,
          expense.paymentMethod,
          expense.amount,
          expense.notes,
        ]),
      ]
    );
    toast.success("Export ready", `${filtered.length} expenses written to CSV.`);
  };

  return (
    <>
      <PageHeader
        title="Expenses"
        description="Track studio spending, suppliers and running costs."
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
              New expense
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryTile label="Filtered spend" value={formatCurrency(filteredTotal, currency)} />
        <SummaryTile label="Entries" value={formatNumber(filtered.length)} />
        <SummaryTile label="Average entry" value={formatCurrency(average, currency)} />
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 border-b border-border pb-4">
          <SearchInput
            value={search}
            onChange={(value) => {
              setSearch(value);
              resetPage();
            }}
            placeholder="Search description, notes or category…"
            className="min-w-56 flex-1"
          />
          <Field label="Type" htmlFor="expenses-type" className="w-40">
            <Select
              id="expenses-type"
              value={typeFilter}
              onChange={(event) => {
                setTypeFilter(event.target.value);
                resetPage();
              }}
            >
              <option value="all">All types</option>
              {[...new Set(expenses.map((expense) => expense.type))].sort().map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Category" htmlFor="expenses-category" className="w-40">
            <Select
              id="expenses-category"
              value={categoryFilter}
              onChange={(event) => {
                setCategoryFilter(event.target.value);
                resetPage();
              }}
            >
              <option value="all">All categories</option>
              {categories.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="From" htmlFor="expenses-from" className="w-40">
            <Input
              id="expenses-from"
              type="date"
              value={from}
              max={to || undefined}
              onChange={(event) => {
                setFrom(event.target.value);
                resetPage();
              }}
            />
          </Field>
          <Field label="To" htmlFor="expenses-to" className="w-40">
            <Input
              id="expenses-to"
              type="date"
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
                    <TH>Date</TH>
                    <TH>Description</TH>
                    <TH>Type</TH>
                    <TH>Payment</TH>
                    <TH className="text-end">Amount</TH>
                    <TH className="text-end">Actions</TH>
                  </TR>
                </THead>
                <TBody>
                  {rows.map((expense) => (
                    <TR key={expense.id}>
                      <TD className="whitespace-nowrap text-muted-foreground">
                        {formatDate(expense.date)}
                      </TD>
                      <TD className="max-w-64">
                        <span className="block truncate font-medium">{expense.description}</span>
                        {expense.category ? (
                          <span className="block truncate text-xs text-faint-foreground">
                            {expense.category}
                          </span>
                        ) : null}
                      </TD>
                      <TD>
                        <Badge tone="neutral">{expense.type}</Badge>
                      </TD>
                      <TD className="whitespace-nowrap text-muted-foreground">
                        {expense.paymentMethod}
                      </TD>
                      <TD className="text-end font-semibold tabular-nums">
                        {formatCurrency(expense.amount, currency)}
                      </TD>
                      <TD>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            aria-label={`Edit ${expense.description}`}
                            onClick={() => {
                              setEditing(expense);
                              setFormOpen(true);
                            }}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-danger hover:bg-danger-soft"
                            aria-label={`Delete ${expense.description}`}
                            onClick={() => setPendingDelete(expense)}
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
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                Rows
                <select
                  value={pageSize}
                  onChange={(event) => {
                    setPageSize(Number(event.target.value));
                    resetPage();
                  }}
                  className="h-8 cursor-pointer rounded-lg border border-border bg-surface px-2 text-xs text-foreground"
                >
                  {PAGE_SIZES.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>
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
            icon={<Wallet className="size-5" />}
            title={expenses.length ? "No expenses match these filters" : "No expenses yet"}
            description={
              expenses.length
                ? "Try clearing the search or widening the date range."
                : "Record your first cost to keep the profit picture honest."
            }
            action={
              expenses.length ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setTypeFilter("all");
                    setCategoryFilter("all");
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
                  New expense
                </Button>
              )
            }
          />
        )}
      </Card>

      {formOpen ? (
        <ExpenseForm
          key={editing?.id ?? "new"}
          expense={editing}
          currency={currency}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
          onSubmit={handleSubmit}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete this expense?"
        description={
          pendingDelete
            ? `“${pendingDelete.description}” for ${formatCurrency(pendingDelete.amount, currency)} will be permanently removed. This cannot be undone.`
            : ""
        }
        confirmLabel="Delete expense"
        destructive
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-3 shadow-card">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums text-foreground">{value}</p>
    </div>
  );
}
