"use client";

import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "./Button";

interface Option {
  value: string;
  label: string;
}

interface SegmentedControlProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  ariaLabel?: string;
}

export function SegmentedControl({
  options,
  value,
  onChange,
  className,
  ariaLabel,
}: SegmentedControlProps) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex flex-none items-center gap-0.5 rounded-xl border border-border bg-surface-muted p-0.5",
        className
      )}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors duration-150",
              selected
                ? "bg-surface text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
  className,
}: SearchInputProps) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-faint-foreground" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-lg border border-border bg-surface ps-9 pe-9 text-sm text-foreground placeholder:text-faint-foreground transition-colors duration-150 hover:border-border-strong focus:border-brand focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute end-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-faint-foreground transition-colors duration-150 hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      ) : null}
    </div>
  );
}

interface PaginationProps {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
  className?: string;
}

export function Pagination({
  page,
  pageCount,
  total,
  pageSize,
  onChange,
  className,
}: PaginationProps) {
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  const pages: number[] = [];
  const start = Math.max(1, Math.min(page - 1, pageCount - 2));
  for (let index = start; index <= Math.min(pageCount, start + 2); index += 1) {
    pages.push(index);
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 px-1 py-3",
        className
      )}
    >
      <p className="text-xs text-muted-foreground">
        Showing <span className="font-semibold tabular-nums text-foreground">{from}</span>–
        <span className="font-semibold tabular-nums text-foreground">{to}</span> of{" "}
        <span className="font-semibold tabular-nums text-foreground">{total}</span>
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft className="size-4" />
        </Button>
        {pages.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onChange(value)}
            aria-current={value === page ? "page" : undefined}
            className={cn(
              "h-8 min-w-8 rounded-lg px-2 text-xs font-semibold tabular-nums transition-colors duration-150",
              value === page
                ? "bg-brand text-brand-foreground"
                : "text-muted-foreground hover:bg-surface-muted hover:text-foreground"
            )}
          >
            {value}
          </button>
        ))}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onChange(page + 1)}
          disabled={page >= pageCount}
          aria-label="Next page"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-end justify-between gap-3 pb-1",
        className
      )}
    >
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight text-foreground">{title}</h1>
        {description ? (
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
