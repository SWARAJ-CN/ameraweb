"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Input";
import { EXPENSE_TYPES, PAYMENT_METHODS, type Expense } from "@/lib/types";
import type { ExpenseDraft } from "@/lib/normalize";
import { parseDateInput, toDateInputValue } from "@/lib/format";

const num = (value: string): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

interface ExpenseFormProps {
  expense: Expense | null;
  currency: string;
  onClose: () => void;
  onSubmit: (draft: ExpenseDraft) => Promise<void>;
}

export function ExpenseForm({
  expense,
  currency,
  onClose,
  onSubmit,
}: ExpenseFormProps) {
  const [type, setType] = useState(() => expense?.type || "Materials");
  const [description, setDescription] = useState(() => expense?.description ?? "");
  const [amount, setAmount] = useState(() => String(expense?.amount ?? 0));
  const [paymentMethod, setPaymentMethod] = useState(() => expense?.paymentMethod || "Cash");
  const [category, setCategory] = useState(() =>
    expense && expense.category !== "Misc" ? expense.category : ""
  );
  const [notes, setNotes] = useState(() => expense?.notes ?? "");
  const [date, setDate] = useState(() =>
    toDateInputValue(expense?.date ?? new Date())
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!description.trim()) {
      setError("A description helps you recognise this expense later.");
      return;
    }
    if (num(amount) <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        type,
        description: description.trim(),
        amount: num(amount),
        paymentMethod,
        category: category.trim() || "Misc",
        notes: notes.trim(),
        date: (parseDateInput(date) ?? new Date()).toISOString(),
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the expense.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={expense ? "Edit expense" : "New expense"}
      description={`Amounts are recorded in ${currency}.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving}>
            {expense ? "Save changes" : "Create expense"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Expense type" htmlFor="expense-type">
            <Select
              id="expense-type"
              value={type}
              onChange={(event) => setType(event.target.value)}
            >
              {EXPENSE_TYPES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Date" htmlFor="expense-date">
            <Input
              id="expense-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </Field>
          <Field label="Amount" htmlFor="expense-amount" required>
            <Input
              id="expense-amount"
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </Field>
          <Field label="Payment method" htmlFor="expense-payment">
            <Select
              id="expense-payment"
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value)}
            >
              {PAYMENT_METHODS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Description" htmlFor="expense-description" required>
          <Input
            id="expense-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Cotton fabric restock"
          />
        </Field>

        <Field
          label="Category"
          htmlFor="expense-category"
          hint="Optional label used for grouping in reports."
        >
          <Input
            id="expense-category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            placeholder="Misc"
          />
        </Field>

        <Field label="Notes" htmlFor="expense-notes">
          <Textarea
            id="expense-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Supplier, invoice number, anything worth remembering…"
          />
        </Field>

        {error ? (
          <p
            role="alert"
            className="rounded-lg bg-danger-soft px-3 py-2 text-xs font-medium text-danger"
          >
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
