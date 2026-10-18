"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Disclosure } from "@heroui/react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Input";
import { DateInput } from "@/components/ui/DatePicker";
import { computeSaleTotals, type SaleDraft } from "@/lib/normalize";
import { formatCurrency, parseDateInput, toDateInputValue } from "@/lib/format";
import {
  EMPTY_ADDRESS,
  type CustomerAddress,
  type Product,
  type Sale,
  type SaleItem,
} from "@/lib/types";

let itemSeq = 0;
const blankItem = (): SaleItem => ({ id: `new-${(itemSeq += 1)}`, name: "", qty: 1, price: 0 });
const num = (value: string): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

interface SaleFormProps {
  sale: Sale | null;
  products: Product[];
  currency: string;
  nextBillNumber: string;
  onClose: () => void;
  onSubmit: (draft: SaleDraft) => Promise<void>;
}

export function SaleForm({
  sale,
  products,
  currency,
  nextBillNumber,
  onClose,
  onSubmit,
}: SaleFormProps) {
  const [billNumber, setBillNumber] = useState(() => sale?.billNumber ?? nextBillNumber);
  const [date, setDate] = useState(() => toDateInputValue(sale?.date ?? new Date()));
  const [billType, setBillType] = useState<"product" | "custom">(() => sale?.billType ?? "product");
  const [saleType, setSaleType] = useState(() => sale?.saleType ?? "Product Sale");
  const [customerName, setCustomerName] = useState(() => sale?.customerName ?? "");
  const [address, setAddress] = useState<CustomerAddress>(
    () => sale?.customerAddress ?? { ...EMPTY_ADDRESS }
  );
  const [items, setItems] = useState<SaleItem[]>(() =>
    sale?.items.length ? sale.items.map((item) => ({ ...item })) : [blankItem()]
  );
  const [customAmount, setCustomAmount] = useState(() => String(sale?.customAmount ?? 0));
  const [handlingFee, setHandlingFee] = useState(() => String(sale?.handlingFee ?? 0));
  const [deliveryFee, setDeliveryFee] = useState(() => String(sale?.deliveryFee ?? 0));
  const [discount, setDiscount] = useState(() => String(sale?.discount ?? 0));
  const [advancePaid, setAdvancePaid] = useState(() => String(sale?.advancePaid ?? 0));
  const [showAddress, setShowAddress] = useState(() =>
    Boolean(
      sale &&
        (sale.customerAddress.phone ||
          sale.customerAddress.addressLine1 ||
          sale.customerAddress.city)
    )
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const totals = useMemo(
    () =>
      computeSaleTotals(items, {
        customAmount: num(customAmount),
        handlingFee: num(handlingFee),
        deliveryFee: num(deliveryFee),
        discount: num(discount),
      }),
    [items, customAmount, handlingFee, deliveryFee, discount]
  );

  const updateItem = (id: string, patch: Partial<SaleItem>) =>
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );

  const submit = async () => {
    if (!billNumber.trim()) {
      setError("Bill number is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        billNumber: billNumber.trim(),
        billType,
        saleType: saleType.trim() || (billType === "custom" ? "Custom Order" : "Product Sale"),
        customerName: customerName.trim() || "Walk-in Customer",
        customerAddress: address,
        items: items.filter((item) => item.name.trim() || item.price > 0),
        customAmount: num(customAmount),
        handlingFee: num(handlingFee),
        deliveryFee: num(deliveryFee),
        discount: num(discount),
        advancePaid: Math.max(0, num(advancePaid)),
        productAmount: totals.productAmount,
        total: totals.total,
        date: (parseDateInput(date) ?? new Date()).toISOString(),
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the sale.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={sale ? `Edit ${sale.billNumber}` : "New sale"}
      description="Line items, fees and customer details are all optional except the bill number."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving}>
            {sale ? "Save changes" : "Create sale"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Bill number" htmlFor="sale-bill" required>
            <Input
              id="sale-bill"
              value={billNumber}
              onChange={(event) => setBillNumber(event.target.value)}
              placeholder="AM-1001"
            />
          </Field>
          <Field label="Sale date" htmlFor="sale-date">
            <DateInput
              id="sale-date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </Field>
          <Field label="Bill type" htmlFor="sale-type">
            <Select
              id="sale-type"
              value={billType}
              onChange={(event) => {
                const value = event.target.value as "product" | "custom";
                setBillType(value);
                setSaleType(value === "custom" ? "Custom Order" : "Product Sale");
              }}
            >
              <option value="product">Product sale</option>
              <option value="custom">Custom order</option>
            </Select>
          </Field>
          <Field label="Sale label" htmlFor="sale-label">
            <Input
              id="sale-label"
              value={saleType}
              onChange={(event) => setSaleType(event.target.value)}
              placeholder="Product Sale"
            />
          </Field>
        </div>

        <Field label="Customer name" htmlFor="sale-customer">
          <Input
            id="sale-customer"
            value={customerName}
            onChange={(event) => setCustomerName(event.target.value)}
            placeholder="Walk-in Customer"
          />
        </Field>

        <Disclosure
          className="rounded-xl border border-border"
          isExpanded={showAddress}
          onExpandedChange={setShowAddress}
        >
          <Disclosure.Heading>
            <Disclosure.Trigger className="flex w-full items-center justify-between gap-2 rounded-none border-0 bg-transparent px-4 py-3 text-start text-sm font-semibold text-foreground">
              Customer address
              <Disclosure.Indicator />
            </Disclosure.Trigger>
          </Disclosure.Heading>
          <Disclosure.Content>
            <Disclosure.Body className="grid gap-4 border-t border-border p-4 sm:grid-cols-2">
              <Field label="Phone" htmlFor="addr-phone">
                <Input
                  id="addr-phone"
                  value={address.phone}
                  onChange={(event) => setAddress({ ...address, phone: event.target.value })}
                  placeholder="+91 98765 43210"
                />
              </Field>
              <Field label="Pincode" htmlFor="addr-pincode">
                <Input
                  id="addr-pincode"
                  value={address.pincode}
                  onChange={(event) => setAddress({ ...address, pincode: event.target.value })}
                />
              </Field>
              <Field label="Address line 1" htmlFor="addr-1" className="sm:col-span-2">
                <Input
                  id="addr-1"
                  value={address.addressLine1}
                  onChange={(event) =>
                    setAddress({ ...address, addressLine1: event.target.value })
                  }
                />
              </Field>
              <Field label="Address line 2" htmlFor="addr-2" className="sm:col-span-2">
                <Input
                  id="addr-2"
                  value={address.addressLine2}
                  onChange={(event) =>
                    setAddress({ ...address, addressLine2: event.target.value })
                  }
                />
              </Field>
              <Field label="Landmark" htmlFor="addr-landmark">
                <Input
                  id="addr-landmark"
                  value={address.landmark}
                  onChange={(event) => setAddress({ ...address, landmark: event.target.value })}
                />
              </Field>
              <Field label="City" htmlFor="addr-city">
                <Input
                  id="addr-city"
                  value={address.city}
                  onChange={(event) => setAddress({ ...address, city: event.target.value })}
                />
              </Field>
              <Field label="State" htmlFor="addr-state">
                <Input
                  id="addr-state"
                  value={address.state}
                  onChange={(event) => setAddress({ ...address, state: event.target.value })}
                />
              </Field>
              <Field label="Country" htmlFor="addr-country">
                <Input
                  id="addr-country"
                  value={address.country}
                  onChange={(event) => setAddress({ ...address, country: event.target.value })}
                />
              </Field>
            </Disclosure.Body>
          </Disclosure.Content>
        </Disclosure>

        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Line items
            </p>
            {products.length ? (
              <Select
                aria-label="Add product from catalogue"
                className="h-9 w-auto max-w-56 text-xs"
                value=""
                onChange={(event) => {
                  const product = products.find((entry) => entry.id === event.target.value);
                  if (!product) return;
                  setItems((current) => [
                    ...current,
                    {
                      id: `new-${(itemSeq += 1)}`,
                      name: product.name,
                      qty: 1,
                      price: product.price,
                    },
                  ]);
                }}
              >
                <option value="">Add from catalogue…</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} — {formatCurrency(product.price, currency)}
                  </option>
                ))}
              </Select>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-[1fr_4.5rem_6.5rem_2.5rem] items-center gap-2"
              >
                <Input
                  aria-label="Item name"
                  value={item.name}
                  placeholder="Item name"
                  onChange={(event) => updateItem(item.id, { name: event.target.value })}
                />
                <Input
                  aria-label="Quantity"
                  type="number"
                  min={0}
                  step={1}
                  value={item.qty}
                  onChange={(event) => updateItem(item.id, { qty: num(event.target.value) })}
                />
                <Input
                  aria-label="Unit price"
                  type="number"
                  min={0}
                  step="0.01"
                  value={item.price}
                  onChange={(event) => updateItem(item.id, { price: num(event.target.value) })}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Remove item"
                  className="size-9 text-danger hover:bg-danger-soft"
                  onClick={() =>
                    setItems((current) =>
                      current.length > 1
                        ? current.filter((entry) => entry.id !== item.id)
                        : [blankItem()]
                    )
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => setItems((current) => [...current, blankItem()])}
          >
            <Plus className="size-3.5" />
            Add item
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Custom amount" htmlFor="fee-custom">
            <Input
              id="fee-custom"
              type="number"
              min={0}
              step="0.01"
              value={customAmount}
              onChange={(event) => setCustomAmount(event.target.value)}
            />
          </Field>
          <Field label="Handling fee" htmlFor="fee-handling">
            <Input
              id="fee-handling"
              type="number"
              min={0}
              step="0.01"
              value={handlingFee}
              onChange={(event) => setHandlingFee(event.target.value)}
            />
          </Field>
          <Field label="Delivery fee" htmlFor="fee-delivery">
            <Input
              id="fee-delivery"
              type="number"
              min={0}
              step="0.01"
              value={deliveryFee}
              onChange={(event) => setDeliveryFee(event.target.value)}
            />
          </Field>
          <Field label="Advance paid" htmlFor="sale-advance">
            <Input
              id="sale-advance"
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              value={advancePaid}
              onChange={(event) => setAdvancePaid(event.target.value)}
            />
          </Field>
          <Field label="Discount" htmlFor="fee-discount">
            <Input
              id="fee-discount"
              type="number"
              min={0}
              step="0.01"
              value={discount}
              onChange={(event) => setDiscount(event.target.value)}
            />
          </Field>
        </div>

        <div className="rounded-xl border border-border bg-surface-muted p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Product amount</span>
            <span className="font-semibold tabular-nums text-foreground">
              {formatCurrency(totals.productAmount, currency)}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-base">
            <span className="font-semibold text-foreground">Total payable</span>
            <span className="font-bold tabular-nums text-brand">
              {formatCurrency(totals.total, currency)}
            </span>
          </div>
        </div>

        {error ? (
          <p
            role="alert"
            className="rounded-lg bg-danger-soft px-3 py-2 text-xs font-medium text-danger-soft-foreground"
          >
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
