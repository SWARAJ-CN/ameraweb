"use client";

import { useMemo, useState } from "react";
import {
  Download,
  ExternalLink,
  ImageOff,
  LayoutGrid,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useData } from "@/components/providers/DataProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { ProductForm } from "@/components/features/ProductForm";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState, Skeleton } from "@/components/ui/Feedback";
import { PageHeader, Pagination, SearchInput, SegmentedControl } from "@/components/ui/Controls";
import { Field, Select } from "@/components/ui/Input";
import { TBody, TD, TH, THead, TR, Table, TableWrapper } from "@/components/ui/Table";
import { downloadCsv } from "@/lib/csv";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { Product } from "@/lib/types";
import type { ProductDraft } from "@/components/providers/DataProvider";

const PAGE_SIZES = [12, 24, 48];

export default function ProductsPage() {
  const { products, settings, loading, createProduct, updateProduct, deleteProduct } = useData();
  const toast = useToast();
  const currency = settings.currency;

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sort, setSort] = useState("recent");
  const [view, setView] = useState<"grid" | "table">("grid");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

  const categories = useMemo(
    () => [...new Set(products.map((product) => product.category).filter(Boolean))].sort(),
    [products]
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const list = products.filter((product) => {
      if (categoryFilter !== "all" && (product.category || "Uncategorised") !== categoryFilter) {
        return false;
      }
      if (
        query &&
        !product.name.toLowerCase().includes(query) &&
        !product.details.toLowerCase().includes(query) &&
        !product.category.toLowerCase().includes(query)
      ) {
        return false;
      }
      return true;
    });

    const sorted = [...list];
    if (sort === "price-desc") sorted.sort((a, b) => b.price - a.price);
    else if (sort === "price-asc") sorted.sort((a, b) => a.price - b.price);
    else if (sort === "name") sorted.sort((a, b) => a.name.localeCompare(b.name));
    return sorted;
  }, [products, search, categoryFilter, sort]);

  const resetPage = () => setPage(1);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const rows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const catalogueValue = filtered.reduce((sum, product) => sum + product.price, 0);

  const handleSubmit = async (draft: ProductDraft) => {
    if (editing) {
      await updateProduct(editing.id, draft);
      toast.success("Product updated", draft.name);
    } else {
      await createProduct(draft);
      toast.success("Product added", draft.name);
    }
    setFormOpen(false);
    setEditing(null);
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteProduct(pendingDelete.id);
      toast.success("Product deleted", pendingDelete.name);
      setPendingDelete(null);
    } catch (caught) {
      toast.error(
        "Could not delete the product",
        caught instanceof Error ? caught.message : undefined
      );
    } finally {
      setDeleting(false);
    }
  };

  const exportCsv = () => {
    downloadCsv(
      `amare-products-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        ["Name", "Category", "Price", "Details", "Source URL", "Image URL"],
        ...filtered.map((product) => [
          product.name,
          product.category,
          product.price,
          product.details,
          product.sourceUrl,
          product.imageUri,
        ]),
      ]
    );
    toast.success("Export ready", `${filtered.length} products written to CSV.`);
  };

  return (
    <>
      <PageHeader
        title="Products"
        description="The catalogue used to build bills and price orders."
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
              New product
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
            placeholder="Search products…"
            className="min-w-56 flex-1"
          />
          <Field label="Category" htmlFor="products-category" className="w-44">
            <Select
              id="products-category"
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
          <Field label="Sort" htmlFor="products-sort" className="w-44">
            <Select
              id="products-sort"
              value={sort}
              onChange={(event) => {
                setSort(event.target.value);
                resetPage();
              }}
            >
              <option value="recent">Newest first</option>
              <option value="name">Name (A–Z)</option>
              <option value="price-desc">Price (high → low)</option>
              <option value="price-asc">Price (low → high)</option>
            </Select>
          </Field>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground">View</span>
            <SegmentedControl
              ariaLabel="View mode"
              value={view}
              onChange={(value) => setView(value as "grid" | "table")}
              options={[
                { value: "grid", label: "Grid" },
                { value: "table", label: "Table" },
              ]}
            />
          </div>
        </CardContent>

        {loading ? (
          <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="h-56 rounded-xl" />
            ))}
          </div>
        ) : rows.length ? (
          <>
            {view === "grid" ? (
              <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {rows.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    currency={currency}
                    onEdit={() => {
                      setEditing(product);
                      setFormOpen(true);
                    }}
                    onDelete={() => setPendingDelete(product)}
                  />
                ))}
              </div>
            ) : (
              <TableWrapper>
                <Table>
                  <THead>
                    <TR className="hover:bg-transparent">
                      <TH>Product</TH>
                      <TH>Category</TH>
                      <TH>Added</TH>
                      <TH className="text-end">Price</TH>
                      <TH className="text-end">Actions</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {rows.map((product) => (
                      <TR key={product.id}>
                        <TD>
                          <div className="flex items-center gap-3">
                            <Thumbnail src={product.imageUri} />
                            <span className="max-w-56 truncate font-medium">
                              {product.name}
                            </span>
                          </div>
                        </TD>
                        <TD className="text-muted-foreground">
                          {product.category || "Uncategorised"}
                        </TD>
                        <TD className="whitespace-nowrap text-muted-foreground">
                          {formatDate(product.createdAt)}
                        </TD>
                        <TD className="text-end font-semibold tabular-nums">
                          {formatCurrency(product.price, currency)}
                        </TD>
                        <TD>
                          <div className="flex items-center justify-end gap-1">
                            {product.sourceUrl ? (
                              <a
                                href={product.sourceUrl}
                                target="_blank"
                                rel="noreferrer noopener"
                                aria-label={`Open source for ${product.name}`}
                                className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-surface-muted hover:text-foreground"
                              >
                                <ExternalLink className="size-4" />
                              </a>
                            ) : null}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              aria-label={`Edit ${product.name}`}
                              onClick={() => {
                                setEditing(product);
                                setFormOpen(true);
                              }}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 text-danger hover:bg-danger-soft"
                              aria-label={`Delete ${product.name}`}
                              onClick={() => setPendingDelete(product)}
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
            )}

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
                  Catalogue value{" "}
                  <span className="font-semibold tabular-nums text-foreground">
                    {formatCurrency(catalogueValue, currency)}
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
            icon={<LayoutGrid className="size-5" />}
            title={products.length ? "No products match these filters" : "No products yet"}
            description={
              products.length
                ? "Try clearing the search or choosing another category."
                : "Add your first catalogue item to speed up billing."
            }
            action={
              products.length ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setCategoryFilter("all");
                    setPage(1);
                  }}
                >
                  Clear filters
                </Button>
              ) : (
                <Button size="sm" onClick={() => setFormOpen(true)}>
                  <Plus className="size-4" />
                  New product
                </Button>
              )
            }
          />
        )}
      </Card>

      {formOpen ? (
        <ProductForm
          key={editing?.id ?? "new"}
          product={editing}
          currency={currency}
          categories={categories}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
          onSubmit={handleSubmit}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete this product?"
        description={
          pendingDelete
            ? `“${pendingDelete.name}” will be removed from the catalogue. Existing bills keep their line items.`
            : ""
        }
        confirmLabel="Delete product"
        destructive
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}

function Thumbnail({ src, className }: { src: string; className?: string }) {
  return (
    <span
      className={cn(
        "grid size-10 flex-none place-items-center overflow-hidden rounded-lg border border-border bg-surface-muted",
        className
      )}
    >
      {src ? (
        <img src={src} alt="" loading="lazy" className="size-full object-cover" />
      ) : (
        <ImageOff className="size-4 text-faint-foreground" />
      )}
    </span>
  );
}

function ProductCard({
  product,
  currency,
  onEdit,
  onDelete,
}: {
  product: Product;
  currency: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-card transition-colors duration-150 hover:border-border-strong">
      <div className="relative aspect-4/3 overflow-hidden bg-surface-muted">
        {product.imageUri ? (
          <img
            src={product.imageUri}
            alt={product.name}
            loading="lazy"
            className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <span className="grid size-full place-items-center">
            <ImageOff className="size-7 text-faint-foreground" />
          </span>
        )}
        <div className="absolute end-2 top-2 flex gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100">
          <Button
            variant="secondary"
            size="icon"
            className="size-8"
            aria-label={`Edit ${product.name}`}
            onClick={onEdit}
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="size-8 text-danger"
            aria-label={`Delete ${product.name}`}
            onClick={onDelete}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3.5">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
            {product.name}
          </p>
          <span className="flex-none text-sm font-bold tabular-nums text-brand">
            {formatCurrency(product.price, currency)}
          </span>
        </div>
        <p className="text-xs text-faint-foreground">
          {product.category || "Uncategorised"}
        </p>
        {product.details ? (
          <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {product.details}
          </p>
        ) : null}
        {product.sourceUrl ? (
          <a
            href={product.sourceUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-auto inline-flex items-center gap-1 pt-2 text-xs font-semibold text-brand hover:underline"
          >
            <ExternalLink className="size-3" />
            Source
          </a>
        ) : null}
      </div>
    </div>
  );
}
