"use client";

import { useState } from "react";
import { ImageOff } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Input";
import type { Product } from "@/lib/types";
import type { ProductDraft } from "@/components/providers/DataProvider";
import { formatCurrency } from "@/lib/format";

const num = (value: string): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

interface ProductFormProps {
  product: Product | null;
  currency: string;
  categories: string[];
  onClose: () => void;
  onSubmit: (draft: ProductDraft) => Promise<void>;
}

export function ProductForm({
  product,
  currency,
  categories,
  onClose,
  onSubmit,
}: ProductFormProps) {
  const [name, setName] = useState(() => product?.name ?? "");
  const [price, setPrice] = useState(() => String(product?.price ?? 0));
  const [category, setCategory] = useState(() => product?.category ?? "");
  const [imageUri, setImageUri] = useState(() => product?.imageUri ?? "");
  const [sourceUrl, setSourceUrl] = useState(() => product?.sourceUrl ?? "");
  const [details, setDetails] = useState(() => product?.details ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim()) {
      setError("A product name is required.");
      return;
    }
    if (num(price) < 0) {
      setError("Price cannot be negative.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        name: name.trim(),
        price: num(price),
        category: category.trim(),
        imageUri: imageUri.trim(),
        sourceUrl: sourceUrl.trim(),
        details: details.trim(),
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the product.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={product ? "Edit product" : "New product"}
      description="Catalogue entries can be added to any bill as a line item."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving}>
            {product ? "Save changes" : "Add product"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex gap-4">
          <div className="grid size-24 flex-none place-items-center overflow-hidden rounded-xl border border-border bg-surface-muted">
            {imageUri ? (
              <img
                src={imageUri}
                alt=""
                className="size-full object-cover"
                onError={(event) => {
                  event.currentTarget.style.display = "none";
                }}
              />
            ) : (
              <ImageOff className="size-6 text-faint-foreground" />
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <Field label="Name" htmlFor="product-name" required>
              <Input
                id="product-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Crochet keychain"
              />
            </Field>
            <Field label={`Price (${currency})`} htmlFor="product-price">
              <Input
                id="product-price"
                type="number"
                min={0}
                step="0.01"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
              />
            </Field>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category" htmlFor="product-category" hint="Used for grouping in reports.">
            <Input
              id="product-category"
              value={category}
              list="product-category-options"
              onChange={(event) => setCategory(event.target.value)}
              placeholder="Jewellery"
            />
            <datalist id="product-category-options">
              {categories.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          </Field>
          <Field label="Source URL" htmlFor="product-source" hint="Optional supplier or listing link.">
            <Input
              id="product-source"
              type="url"
              value={sourceUrl}
              onChange={(event) => setSourceUrl(event.target.value)}
              placeholder="https://…"
            />
          </Field>
        </div>

        <Field label="Image URL" htmlFor="product-image" hint="Direct link to the product photo.">
          <Input
            id="product-image"
            type="url"
            value={imageUri}
            onChange={(event) => setImageUri(event.target.value)}
            placeholder="https://…"
          />
        </Field>

        <Field label="Details" htmlFor="product-details">
          <Textarea
            id="product-details"
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            placeholder="Materials, dimensions, care instructions…"
          />
        </Field>

        {num(price) > 0 ? (
          <p className="text-xs text-muted-foreground">
            Selling price preview:{" "}
            <span className="font-semibold text-foreground">
              {formatCurrency(num(price), currency)}
            </span>
          </p>
        ) : null}

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
