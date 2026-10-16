"use client";

import { useMemo, useState } from "react";
import { Calculator, Delete, RotateCcw, Save, Trash2 } from "lucide-react";
import { useData } from "@/components/providers/DataProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState, Skeleton } from "@/components/ui/Feedback";
import { PageHeader, SearchInput } from "@/components/ui/Controls";
import { Field, Input } from "@/components/ui/Input";
import { evaluateExpression } from "@/lib/calc";
import { formatCurrency, formatDateTime, formatNumber } from "@/lib/format";
import type { Calculation } from "@/lib/types";

const KEYS = ["7", "8", "9", "/", "4", "5", "6", "*", "1", "2", "3", "-", "0", ".", "%", "+"];

const OPERATOR_KEYS = new Set(["+", "-", "*", "/", "%", "^"]);

const isDigit = (char: string) => char >= "0" && char <= "9";

export default function CalculationsPage() {
  const { calculations, settings, loading, createCalculation, deleteCalculation } = useData();
  const toast = useToast();
  const currency = settings.currency;

  const [expression, setExpression] = useState("");
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Calculation | null>(null);
  const [deleting, setDeleting] = useState(false);

  const evaluation = useMemo(() => evaluateExpression(expression), [expression]);
  const showResult = expression.trim().length > 0;

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return calculations;
    return calculations.filter(
      (entry) =>
        entry.name.toLowerCase().includes(query) ||
        entry.expression.toLowerCase().includes(query)
    );
  }, [calculations, search]);

  const append = (value: string) =>
    setExpression((current) => {
      const last = current.slice(-1);
      const isOperator = (char: string) => OPERATOR_KEYS.has(char);

      // Never start with a binary operator (a leading minus is fine).
      if (!current) return isOperator(value) && value !== "-" ? current : value;

      if (isOperator(value) && isOperator(last)) {
        // Swap the trailing operator, but allow "5*-2" style negatives.
        if (value === "-" && last !== "-") return `${current}${value}`;
        return `${current.slice(0, -1)}${value}`;
      }

      if (value === ".") {
        const tail = current.split(/[^0-9.]/).pop() ?? "";
        if (tail.includes(".")) return current;
        return tail ? `${current}.` : `${current}0.`;
      }

      if (value === "(" && (isDigit(last) || last === ")")) return `${current}*(`;

      if (value === ")") {
        const depth =
          (current.match(/\(/g)?.length ?? 0) - (current.match(/\)/g)?.length ?? 0);
        if (depth <= 0 || isOperator(last) || last === "(") return current;
      }

      return `${current}${value}`;
    });

  const backspace = () => setExpression((current) => current.slice(0, -1));
  const clear = () => {
    setExpression("");
    setName("");
  };

  const save = async () => {
    if (!evaluation.ok) {
      toast.error(
        evaluation.incomplete ? "Finish the expression" : "Nothing to save",
        evaluation.error
      );
      return;
    }
    setSaving(true);
    try {
      await createCalculation({
        name: name.trim() || "Untitled calculation",
        expression: expression.trim(),
        result: evaluation.value,
      });
      toast.success("Calculation saved", name.trim() || "Untitled calculation");
      setName("");
    } catch (caught) {
      toast.error(
        "Could not save the calculation",
        caught instanceof Error ? caught.message : undefined
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteCalculation(pendingDelete.id);
      toast.success("Calculation deleted", pendingDelete.name);
      setPendingDelete(null);
    } catch (caught) {
      toast.error(
        "Could not delete the calculation",
        caught instanceof Error ? caught.message : undefined
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Calculator"
        description="Run pricing and cost maths, then save the ones worth keeping."
      />

      <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
        <Card>
          <CardHeader
            title="Expression"
            description="Use + − × ÷ ^ %, brackets and functions like sqrt(9) or max(2,5)."
            actions={
              <Button variant="ghost" size="sm" onClick={clear}>
                <RotateCcw className="size-3.5" />
                Clear
              </Button>
            }
          />
          <CardContent className="flex flex-col gap-4">
            <Field label="Expression" htmlFor="calc-expression">
              <Input
                id="calc-expression"
                value={expression}
                onChange={(event) => setExpression(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && evaluation.ok) void save();
                }}
                placeholder="1250 * 3 + 80"
                className="h-12 font-mono text-base"
                autoComplete="off"
                spellCheck={false}
              />
            </Field>

            <div
              aria-live="polite"
              className="flex flex-col gap-1 rounded-xl border border-border bg-surface-muted px-4 py-3"
            >
              <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Result
              </span>
              {showResult ? (
                evaluation.ok ? (
                  <>
                    <span className="text-3xl font-bold tabular-nums text-brand">
                      {formatNumber(evaluation.value, 4)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatCurrency(evaluation.value, currency)}
                    </span>
                  </>
                ) : evaluation.incomplete ? (
                  <span className="text-sm font-medium text-muted-foreground">
                    Keep going — the expression isn’t finished yet.
                  </span>
                ) : (
                  <span className="text-sm font-medium text-danger">{evaluation.error}</span>
                )
              ) : (
                <span className="text-sm text-faint-foreground">
                  Type an expression to see the result.
                </span>
              )}
            </div>

            <div className="grid grid-cols-4 gap-2">
              {KEYS.map((key) => (
                <Button
                  key={key}
                  variant="secondary"
                  onClick={() => append(key)}
                  className="h-11 text-base font-semibold"
                  aria-label={`Insert ${key}`}
                >
                  {key}
                </Button>
              ))}
              <Button
                variant="secondary"
                onClick={() => append("(")}
                className="h-11 text-base font-semibold"
                aria-label="Open bracket"
              >
                (
              </Button>
              <Button
                variant="secondary"
                onClick={() => append(")")}
                className="h-11 text-base font-semibold"
                aria-label="Close bracket"
              >
                )
              </Button>
              <Button
                variant="secondary"
                onClick={backspace}
                className="col-span-2 h-11"
                aria-label="Backspace"
              >
                <Delete className="size-4" />
                Backspace
              </Button>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <Field label="Save as" htmlFor="calc-name" className="min-w-48 flex-1">
                <Input
                  id="calc-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Bulk order quote"
                />
              </Field>
              <Button onClick={save} loading={saving} disabled={!evaluation.ok}>
                <Save className="size-4" />
                Save calculation
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            title="Saved calculations"
            description={`${formatNumber(calculations.length)} on file`}
            actions={
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search…"
                className="w-40"
              />
            }
          />
          {loading ? (
            <div className="flex flex-col gap-2 p-5">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-16" />
              ))}
            </div>
          ) : filtered.length ? (
            <ul className="divide-y divide-border">
              {filtered.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center gap-3 px-5 py-3 transition-colors duration-150 hover:bg-surface-muted/60"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setExpression(entry.expression);
                      setName(entry.name);
                    }}
                    className="min-w-0 flex-1 text-start"
                  >
                    <p className="truncate text-sm font-semibold text-foreground">
                      {entry.name}
                    </p>
                    <p className="truncate font-mono text-xs text-muted-foreground">
                      {entry.expression}
                    </p>
                    <p className="mt-0.5 text-[11px] text-faint-foreground">
                      {formatDateTime(entry.savedAt)}
                    </p>
                  </button>
                  <span className="flex-none text-end">
                    <span className="block text-sm font-bold tabular-nums text-foreground">
                      {formatNumber(entry.result, 4)}
                    </span>
                    <span className="block text-[11px] tabular-nums text-faint-foreground">
                      {formatCurrency(entry.result, currency)}
                    </span>
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 flex-none text-danger hover:bg-danger-soft"
                    aria-label={`Delete ${entry.name}`}
                    onClick={() => setPendingDelete(entry)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={<Calculator className="size-5" />}
              title={calculations.length ? "No matches" : "No saved calculations"}
              description={
                calculations.length
                  ? "Try a different search term."
                  : "Evaluate an expression and save it to build a reusable price list."
              }
            />
          )}
        </Card>
      </div>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete this calculation?"
        description={
          pendingDelete
            ? `“${pendingDelete.name}” (${pendingDelete.expression}) will be permanently removed.`
            : ""
        }
        confirmLabel="Delete calculation"
        destructive
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}
